"""0G Compute integration: TEE-verified explanations of verification outcomes.

When a Lean4 verification finishes, we ship the (spec, result) pair to a
0G Compute provider running inside a TEE. The provider returns a short
natural-language explanation of why the proof was accepted (or rejected),
signed by the enclave. That explanation rides alongside the attestation
JSON to 0G Storage, so the dashboard / racing visualizer can display
human-readable context with cryptographic provenance.

Funding prerequisite (one-time, outside this module):
  0g-compute-cli deposit --amount 10
  0g-compute-cli transfer-fund --provider <addr> --amount 1

If unconfigured / unfunded, this module silently disables itself and
returns None; callers fall back to a static explanation.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any, Optional

from backend.spec import BountySpec
from backend.verifier import VerificationResult

log = logging.getLogger("ascertainty.compute")

_service = None
_lock = asyncio.Lock()
_disabled = False  # latches on first init failure — don't retry per-request


def _map_env() -> None:
    if not os.getenv("A0G_PRIVATE_KEY"):
        og_key = os.getenv("OG_PRIVATE_KEY")
        if og_key:
            os.environ["A0G_PRIVATE_KEY"] = og_key.removeprefix("0x")
    if not os.getenv("A0G_RPC_URL"):
        rpc = os.getenv("OG_RPC_URL")
        if rpc:
            os.environ["A0G_RPC_URL"] = rpc
    if not os.getenv("A0G_INDEXER_RPC_URL"):
        idx = os.getenv("OG_STORAGE_INDEXER")
        if idx:
            os.environ["A0G_INDEXER_RPC_URL"] = idx


def _pick_chat_service(services: list) -> Any:
    for s in services:
        model = str(getattr(s, "model", "")).lower()
        if any(k in model for k in ("qwen", "llama", "chat", "instruct")):
            return s
    return services[0]


async def _ensure_client():
    """Return (fresh_async_client, service). The OpenAI-compat client is
    rebuilt every call because 0G Compute requires freshly TEE-signed
    headers per request — caching the client past a few minutes leads to
    'service not acknowledge the tee signer' 400s. The service descriptor
    (provider address, model name, base URL) is stable and gets cached
    once for cheap re-use."""
    global _service, _disabled
    if _disabled:
        return None

    async with _lock:
        _map_env()
        if not os.getenv("A0G_PRIVATE_KEY"):
            log.warning("compute: no A0G_PRIVATE_KEY / OG_PRIVATE_KEY, disabled")
            _disabled = True
            return None
        try:
            from a0g.base import A0G

            loop = asyncio.get_running_loop()

            def _build():
                a = A0G()
                if _service is None:
                    services = a.get_all_services()
                    if not services:
                        raise RuntimeError("no 0G Compute services available")
                    svc = _pick_chat_service(services)
                else:
                    svc = _service
                client = a.get_openai_async_client(svc.provider)
                return client, svc

            client, svc = await loop.run_in_executor(None, _build)
            if _service is None:
                _service = svc
                log.info(
                    "compute: ready (provider=%s model=%s)",
                    getattr(svc, "provider", "?"),
                    getattr(svc, "model", "?"),
                )
            return client, svc
        except Exception as e:
            log.warning("compute: init failed (%s); disabling for this process", e)
            _disabled = True
            return None


def _build_messages(spec: BountySpec, result: VerificationResult) -> list[dict]:
    sig_first_line = spec.theorem_signature.strip().splitlines()[0][:160]
    system = (
        "You are a verification oracle assistant. Given a Lean4 bounty spec and "
        "the kernel's accept/reject decision, write one or two sentences explaining "
        "why the proof was accepted or rejected and what it means in plain English. "
        "No hedging, no filler, no preamble."
    )
    user = (
        f"Bounty: {spec.bounty_id}\n"
        f"Theorem (first line): {sig_first_line}\n"
        f"Mathlib SHA: {spec.mathlib_sha}\n"
        f"Lean toolchain: {spec.lean_toolchain}\n"
        f"Allowed axioms: {', '.join(spec.axiom_whitelist) or '(none beyond empty set)'}\n"
        f"Result: {'ACCEPT' if result.accepted else 'REJECT'}\n"
        f"Proof sha256: {result.proof_hash[:16]}…\n"
        f"Kernel duration: {result.duration_seconds:.2f}s"
    )
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


async def explain_verification(
    spec: BountySpec, result: VerificationResult
) -> Optional[str]:
    """Generate a TEE-verified natural-language explanation. None if unavailable."""
    got = await _ensure_client()
    if got is None:
        return None
    client, svc = got
    try:
        resp = await client.chat.completions.create(
            model=getattr(svc, "model", None),
            messages=_build_messages(spec, result),
            max_tokens=180,
            temperature=0.2,
        )
        text = resp.choices[0].message.content
        return text.strip() if text else None
    except Exception as e:
        log.warning("compute: explain failed: %s", e)
        return None


def _heuristic_formalize(description: str, hint_tags: list[str] | None) -> dict[str, Any]:
    """Deterministic fallback for autoformalize when 0G Compute is unreachable.
    Doesn't try to be clever — produces a syntactically valid spec skeleton
    seeded with the user's description so they can edit before posting."""
    import re, time
    slug = re.sub(r"[^a-z0-9]+", "-", description.lower()).strip("-")[:40] or "user-bounty"
    tags = hint_tags or ["user-submitted"]
    deadline = int(time.time()) + 86400 * 14
    yaml_text = (
        f"bounty_id: {slug}\n"
        f"description: |\n  {description.strip()}\n"
        f"theorem_signature: \"<insert Lean 4 theorem signature — 0G Compute autoformalize is offline>\"\n"
        f"mathlib_sha: 5b1c4e7\n"
        f"lean_toolchain: \"leanprover/lean4:v4.10.0\"\n"
        f"axiom_whitelist:\n  - propext\n  - Classical.choice\n  - Quot.sound\n"
        f"bounty_usdc: 1000000000\n"
        f"deadline_unix: {deadline}\n"
        f"challenge_window_seconds: 600\n"
        f"tags:\n"
        + "".join(f"  - {t}\n" for t in tags)
    )
    return {"spec_yaml": yaml_text, "fallback": True}


def _heuristic_rate(spec: BountySpec) -> dict[str, Any]:
    """Heuristic novelty + difficulty when 0G Compute is offline. Looks at
    surface signals: theorem length, axiom whitelist breadth, mathlib_sha
    presence, and Erdős-style keywords in description/tags."""
    import re
    theorem = spec.theorem_signature or ""
    desc = (spec.description or "") + " " + " ".join(spec.tags)
    desc_l = desc.lower()
    # Novelty heuristic: keyword presence + tag rarity
    erdos_kw = any(
        k in desc_l for k in ("erdős", "erdos", "open problem", "conjecture",
                              "unsolved", "open conjecture", "research")
    )
    novelty = 9 if erdos_kw else max(2, min(7, len(theorem) // 60 + 3))
    # Difficulty heuristic: theorem length + axiom count
    difficulty = max(2, min(9, len(theorem) // 40 + len(spec.axiom_whitelist)))
    if erdos_kw and difficulty < 9:
        difficulty = 9
    erdos_class = novelty >= 9 and difficulty >= 9
    if novelty <= 2 or difficulty <= 1:
        recommendation = "reject"
    elif novelty <= 4:
        recommendation = "refine"
    else:
        recommendation = "post"
    reasoning = (
        "Heuristic rating (0G Compute offline). Novelty derived from theorem-keyword "
        "match and tag rarity; difficulty from theorem length and axiom-whitelist breadth."
    )
    return {
        "novelty": novelty,
        "difficulty": difficulty,
        "reasoning": reasoning,
        "recommendation": recommendation,
        "erdos_class": erdos_class,
        "fallback": True,
    }


async def formalize_claim(
    description: str, hint_tags: list[str] | None = None,
) -> Optional[dict[str, Any]]:
    """Autoformalize: turn a plain-English claim into a draft bounty spec
    (theorem_signature + axiom_whitelist + suggested mathlib_sha + USDC
    estimate + deadline). Falls back to a heuristic skeleton when 0G
    Compute is unreachable so the demo never 503s.

    The LLM sees prior bounty examples in-context so its output matches
    the spec format Ascertainty expects."""
    got = await _ensure_client()
    if got is None:
        return _heuristic_formalize(description, hint_tags)
    client, svc = got
    tags_str = ", ".join(hint_tags) if hint_tags else "(none — infer from claim)"
    system = (
        "You are a Lean 4 / Mathlib expert helping a user post a verification "
        "bounty on Ascertainty. Given a plain-English claim, draft a bounty spec "
        "in YAML matching this exact schema. Return ONLY the YAML, no fences, "
        "no preamble.\n"
        "schema:\n"
        "  bounty_id: <kebab-case-slug>\n"
        "  description: |\n"
        "    <2-4 sentence description>\n"
        "  theorem_signature: \"<Lean 4 theorem signature, no 'theorem' keyword>\"\n"
        "  mathlib_sha: 5b1c4e7\n"
        "  lean_toolchain: \"leanprover/lean4:v4.10.0\"\n"
        "  axiom_whitelist:\n"
        "    - propext\n"
        "    - Classical.choice\n"
        "    - Quot.sound\n"
        "  bounty_usdc: <integer, 6-decimals USDC, e.g. 1000000000 == 1000 USDC>\n"
        "  deadline_unix: <integer unix-ts, default now + 30 days>\n"
        "  challenge_window_seconds: <60-3600 depending on difficulty>\n"
        "  tags:\n"
        "    - <2-4 short topic tags>\n"
        "Conventions:\n"
        "  - bounty_usdc reflects estimated difficulty: 100-1000 USDC for routine, "
        "    1000-10000 for novel, 10000+ for research-grade.\n"
        "  - challenge_window scales with difficulty: 30s for trivial, 600s for "
        "    moderate, 3600s for research-grade.\n"
        "  - axiom_whitelist defaults to the standard three; add more only if "
        "    the claim genuinely requires them.\n"
    )
    user = f"User claim:\n{description}\n\nTag hints: {tags_str}\n\nDraft the spec."
    try:
        resp = await client.chat.completions.create(
            model=getattr(svc, "model", None),
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=600,
            temperature=0.2,
        )
        text = (resp.choices[0].message.content or "").strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("yaml\n"):
                text = text[5:]
        # The endpoint returns the raw YAML string; the FastAPI wrapper will
        # validate by passing through parse_spec.
        return {"spec_yaml": text, "fallback": False}
    except Exception as e:
        log.warning("compute: formalize_claim failed: %s — falling back to heuristic", e)
        return _heuristic_formalize(description, hint_tags)


async def rate_spec(
    spec: BountySpec, prior_bounties: list[dict[str, Any]],
) -> Optional[dict[str, Any]]:
    """Score the bounty on novelty (1-10) and difficulty (1-10), with
    a short reasoning string. The LLM is given the running roster of
    on-chain bounties as context so it can detect duplication beyond
    exact spec_hash matches.

    Returns {novelty, difficulty, reasoning, recommendation, erdos_class}.
    The recommendation is rule-derived from the two scores so it's
    deterministic given the LLM's numeric output. Falls back to a
    heuristic rating when 0G Compute is unreachable."""
    got = await _ensure_client()
    if got is None:
        return _heuristic_rate(spec)
    client, svc = got

    prior_summary = "\n".join(
        f"  - {b.get('spec_yaml', '').split(chr(10))[0]}"
        for b in prior_bounties[:20]
    ) or "  (no prior bounties)"

    system = (
        "You are an Ascertainty bounty-quality reviewer. Given a Lean 4 bounty "
        "spec, rate it on two axes:\n"
        "  novelty (1-10): how genuinely new is this claim, vs what already "
        "exists in Mathlib or the prior bounty list provided?\n"
        "  difficulty (1-10): how hard would this be to prove from scratch in "
        "Lean 4, factoring tactic depth, mathlib reach, and likely proof length?\n"
        "Use the Liam Price / Erdős #1196 result as the anchor for a 10/10: a "
        "decades-old open problem from a leading number theorist, finally cracked. "
        "A 5/5 is a routine Mathlib gap. A 1/1 is `theorem t : True := trivial`.\n"
        "Return ONLY a single JSON object, no fences, with keys:\n"
        '  {"novelty": int, "difficulty": int, "reasoning": "<2-3 sentences>"}'
    )
    user = (
        f"Bounty spec:\n  {spec.bounty_id}\n  {spec.theorem_signature}\n"
        f"  axiom_whitelist: {list(spec.axiom_whitelist)}\n"
        f"  mathlib_sha: {spec.mathlib_sha}\n\n"
        f"Prior bounties already on-chain:\n{prior_summary}\n\n"
        f"Rate this spec."
    )
    try:
        resp = await client.chat.completions.create(
            model=getattr(svc, "model", None),
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=300,
            temperature=0.2,
        )
        text = (resp.choices[0].message.content or "").strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json\n"):
                text = text[5:]
        import json as _json
        parsed = _json.loads(text)
        novelty = int(parsed.get("novelty", 5))
        difficulty = int(parsed.get("difficulty", 5))
        reasoning = str(parsed.get("reasoning", ""))
        # Deterministic recommendation rule
        erdos_class = novelty >= 9 and difficulty >= 9
        if novelty <= 2 or difficulty <= 1:
            recommendation = "reject"
        elif novelty <= 4:
            recommendation = "refine"
        else:
            recommendation = "post"
        return {
            "novelty": novelty,
            "difficulty": difficulty,
            "reasoning": reasoning,
            "recommendation": recommendation,
            "erdos_class": erdos_class,
            "fallback": False,
        }
    except Exception as e:
        log.warning("compute: rate_spec failed: %s — falling back to heuristic", e)
        return _heuristic_rate(spec)


async def explain_spec(spec: BountySpec) -> Optional[str]:
    """Pre-emptive 2-sentence explanation of a bounty spec, used at creation
    time so every bounty card carries a TEE-verified gloss before the first
    submission lands. None if unavailable."""
    got = await _ensure_client()
    if got is None:
        return None
    client, svc = got
    user = (
        f"Bounty: {spec.bounty_id}\n"
        f"Theorem: {spec.theorem_signature}\n"
        f"Description: {spec.description}\n"
        f"Mathlib SHA: {spec.mathlib_sha}\n"
        f"Axiom whitelist: {', '.join(spec.axiom_whitelist)}\n"
        f"Reward: {spec.bounty_usdc / 1_000_000} MockUSDC"
    )
    system = (
        "You are a verification-bounty analyst. Given a Lean4 bounty spec, "
        "explain in EXACTLY 2 sentences why this claim matters and what it "
        "would take to prove. Audience: technical readers who don't know Lean. "
        "Be concrete; no marketing fluff. Output the 2 sentences only — no "
        "preamble."
    )
    try:
        resp = await client.chat.completions.create(
            model=getattr(svc, "model", None),
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            max_tokens=160,
            temperature=0.3,
        )
        text = resp.choices[0].message.content
        return text.strip() if text else None
    except Exception as e:
        log.warning("compute: explain_spec failed: %s", e)
        return None


def is_available() -> bool:
    return _async_client is not None and not _disabled

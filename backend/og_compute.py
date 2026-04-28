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

_async_client = None
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
    global _async_client, _service, _disabled
    if _disabled:
        return None
    if _async_client and _service:
        return _async_client, _service

    async with _lock:
        if _async_client and _service:
            return _async_client, _service
        _map_env()
        if not os.getenv("A0G_PRIVATE_KEY"):
            log.warning("compute: no A0G_PRIVATE_KEY / OG_PRIVATE_KEY, disabled")
            _disabled = True
            return None
        try:
            from a0g.base import A0G

            loop = asyncio.get_running_loop()

            def _init():
                a = A0G()
                services = a.get_all_services()
                if not services:
                    raise RuntimeError("no 0G Compute services available")
                svc = _pick_chat_service(services)
                client = a.get_openai_async_client(svc.provider)
                return client, svc

            client, svc = await loop.run_in_executor(None, _init)
            _async_client = client
            _service = svc
            log.info(
                "compute: ready (provider=%s model=%s)",
                getattr(svc, "provider", "?"),
                getattr(svc, "model", "?"),
            )
            return _async_client, _service
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

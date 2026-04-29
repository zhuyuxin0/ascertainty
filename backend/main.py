import asyncio
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any

import yaml
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend import (
    badges,
    cctp_watcher,
    claim_task,
    db,
    inft,
    keeperhub,
    og_chain,
    og_storage,
    personas,
    publisher,
    telegram_bot,
    watcher,
)
from backend.attestation import build_attestation, sign_attestation
from backend.og_compute import (
    explain_spec,
    explain_verification,
    formalize_claim,
    rate_spec,
    refine_input,
)
from backend.og_storage import upload_attestation
from backend.spec import SpecError, parse_spec, spec_hash
from backend.verifier import verify

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)

_tasks: list[asyncio.Task] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    if og_chain.is_configured():
        _tasks.append(asyncio.create_task(watcher.watcher_task(), name="watcher"))
        _tasks.append(asyncio.create_task(claim_task.claim_task(), name="claim"))
        # iNFT mints run once at startup, idempotent. Best-effort.
        _tasks.append(asyncio.create_task(inft.init(), name="inft_init"))
        _tasks.append(asyncio.create_task(personas.init(), name="personas_init"))
    if os.getenv("TELEGRAM_BOT_TOKEN"):
        _tasks.append(asyncio.create_task(telegram_bot.telegram_task(), name="telegram"))
    if os.getenv("ALCHEMY_API_KEY") or os.getenv("ALCHEMY_WS_URL"):
        _tasks.append(asyncio.create_task(cctp_watcher.cctp_task(), name="cctp"))
    try:
        yield
    finally:
        for t in _tasks:
            t.cancel()
        await asyncio.gather(*_tasks, return_exceptions=True)
        _tasks.clear()


app = FastAPI(title="Ascertainty", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # Localhost (any port) for dev, plus Vercel preview deployments + the
    # production custom domain (root + any subdomain).
    allow_origin_regex=(
        r"^https?://("
        r"localhost(:\d+)?|"
        r"127\.0\.0\.1(:\d+)?|"
        r"(?:[a-z0-9-]+\.)?ascertainty\.xyz|"
        r"(?:[a-z0-9-]+-)?ascertainty(?:-[a-z0-9-]+)?\.vercel\.app"
        r")$"
    ),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.2.0"}


@app.get("/stats")
async def stats():
    return {"bounties": await db.bounty_count()}


@app.get("/bounties")
async def bounties(limit: int = 50):
    return {"bounties": await db.latest_bounties(limit=limit)}


# ---------- bounty lifecycle (off-chain in M2; M3 wires the on-chain side) ----------


class CreateBountyBody(BaseModel):
    spec_yaml: str
    poster_address: str
    # Wallet-driven flow: when set, the frontend already created the
    # bounty on-chain via the connected wallet. Backend only verifies the
    # receipt + parses BountyCreated for the on-chain id; doesn't relay.
    tx_hash: str | None = None


class PrepareCreateBody(BaseModel):
    spec_yaml: str


class FormalizeBody(BaseModel):
    description: str
    tags: list[str] | None = None


@app.post("/bounty/assist/refine")
async def assist_refine(body: FormalizeBody) -> dict[str, Any]:
    """Step 1 of the bounty wizard. Classifies user input as
    valid / refine / operationalize / reject. The frontend gates the
    next step on the outcome — only valid/refine/operationalize unlock
    the rate + dedup steps; reject blocks with a redirect suggestion.

    For refine + operationalize, validates that the LLM's YAML actually
    parses; if not, surfaces the parse error so the user can edit
    inline. Always returns a dict with `outcome` plus the relevant
    fields; never 503s."""
    if not body.description.strip():
        raise HTTPException(status_code=400, detail="input is required")
    result = await refine_input(body.description, body.tags)
    # Validate any returned YAML parses; don't strip it on parse error,
    # so the user can fix it inline.
    if result.get("spec_yaml"):
        try:
            raw = yaml.safe_load(result["spec_yaml"])
            if isinstance(raw, dict):
                parse_spec(raw)
                result["parse_error"] = None
            else:
                result["parse_error"] = "LLM output is not a YAML mapping"
        except (SpecError, yaml.YAMLError) as e:
            result["parse_error"] = str(e)
    return result


@app.post("/bounty/assist/formalize")
async def assist_formalize(body: FormalizeBody) -> dict[str, Any]:
    """Plain-English claim → draft Lean 4 bounty spec via 0G Compute (TEE).
    Frontend pipes the result into the spec textarea; user reviews/edits
    before posting. Returns 503 if 0G Compute is unavailable so the UI
    can surface a clear error."""
    if not body.description.strip():
        raise HTTPException(status_code=400, detail="description is required")
    result = await formalize_claim(body.description, body.tags)
    if result is None:
        # _heuristic_formalize is called inside formalize_claim, so None
        # here indicates a bug rather than provider downtime
        raise HTTPException(
            status_code=500,
            detail="autoformalize returned no result",
        )
    # Validate the LLM output parses; if not, surface the raw YAML so the
    # user can fix it inline rather than losing the suggestion entirely.
    spec_yaml = result["spec_yaml"]
    parse_error: str | None = None
    try:
        raw = yaml.safe_load(spec_yaml)
        if isinstance(raw, dict):
            parse_spec(raw)
        else:
            parse_error = "LLM output is not a YAML mapping"
    except (SpecError, yaml.YAMLError) as e:
        parse_error = str(e)
    return {
        "spec_yaml": spec_yaml,
        "parse_error": parse_error,
        "fallback": bool(result.get("fallback")),
    }


class RateBody(BaseModel):
    spec_yaml: str


@app.post("/bounty/assist/rate")
async def assist_rate(body: RateBody) -> dict[str, Any]:
    """Score the spec on novelty + difficulty (1-10 each), classify Erdős-tier,
    return a deterministic post/refine/reject recommendation."""
    try:
        raw = yaml.safe_load(body.spec_yaml)
        if not isinstance(raw, dict):
            raise SpecError("spec_yaml must be a YAML mapping")
        spec = parse_spec(raw)
    except (SpecError, yaml.YAMLError) as e:
        raise HTTPException(status_code=400, detail=f"invalid spec: {e}")

    prior = await db.latest_bounties(limit=20)
    rating = await rate_spec(spec, prior)
    if rating is None:
        raise HTTPException(status_code=500, detail="rating returned no result")
    return rating


@app.post("/bounty/assist/check-duplicate")
async def assist_check_duplicate(body: RateBody) -> dict[str, Any]:
    """Detect spec collisions + near-duplicates against existing bounties.
    Exact spec_hash collision is a hard duplicate; theorem-text edit
    distance < 0.15 is a soft duplicate worth flagging."""
    try:
        raw = yaml.safe_load(body.spec_yaml)
        if not isinstance(raw, dict):
            raise SpecError("spec_yaml must be a YAML mapping")
        spec = parse_spec(raw)
    except (SpecError, yaml.YAMLError) as e:
        raise HTTPException(status_code=400, detail=f"invalid spec: {e}")

    h = spec_hash(spec)
    duplicates: list[dict[str, Any]] = []
    exact = await db.get_bounty_by_spec_hash(h)
    if exact is not None:
        duplicates.append({
            "bounty_id": exact["id"],
            "similarity": 1.0,
            "kind": "exact",
            "theorem": (
                yaml.safe_load(exact.get("spec_yaml") or "") or {}
            ).get("theorem_signature", ""),
        })

    # Soft-duplicate: normalized Jaccard on token sets of theorem signatures
    candidate_tokens = set(_tokenize(spec.theorem_signature))
    if candidate_tokens:
        for prior in await db.latest_bounties(limit=50):
            if prior["spec_hash"] == h:
                continue
            try:
                prior_spec = parse_spec(yaml.safe_load(prior["spec_yaml"]) or {})
            except Exception:
                continue
            prior_tokens = set(_tokenize(prior_spec.theorem_signature))
            if not prior_tokens:
                continue
            inter = candidate_tokens & prior_tokens
            union = candidate_tokens | prior_tokens
            sim = len(inter) / len(union) if union else 0
            if sim > 0.7:
                duplicates.append({
                    "bounty_id": prior["id"],
                    "similarity": round(sim, 2),
                    "kind": "near",
                    "theorem": prior_spec.theorem_signature,
                })

    duplicates.sort(key=lambda d: -d["similarity"])
    return {
        "duplicates": duplicates[:5],
        "warning_level": (
            "block" if any(d["kind"] == "exact" for d in duplicates)
            else "warn" if duplicates
            else "ok"
        ),
    }


async def _recover_revert_reason(w3, tx_hash: str, receipt) -> str | None:
    """Re-execute the reverted tx at its block via eth_call to read the
    revert reason string. Best-effort — silently returns None if the RPC
    doesn't support tracing or the reason can't be decoded."""
    try:
        tx = await w3.eth.get_transaction(tx_hash)
        call = {
            "from": tx["from"],
            "to": tx["to"],
            "data": tx["input"],
            "value": tx.get("value", 0),
            "gas": tx["gas"],
        }
        await w3.eth.call(call, block_identifier=receipt["blockNumber"])
        return None  # didn't revert in eth_call (race or RPC quirk)
    except Exception as e:
        msg = str(e)
        # web3.py wraps revert reasons like: 'execution reverted: deadline past'
        marker = "execution reverted:"
        if marker in msg:
            return msg.split(marker, 1)[1].strip().strip("'\"")
        # Some RPCs return reason in nested dict — check common shapes
        if hasattr(e, "args") and e.args:
            inner = str(e.args[0])
            if marker in inner:
                return inner.split(marker, 1)[1].strip().strip("'\"")
        return None


def _tokenize(s: str) -> list[str]:
    """Cheap lexical tokenizer — splits on whitespace + Lean punctuation,
    drops 1-char tokens. Good enough for Jaccard similarity on theorem
    signatures."""
    import re
    return [t for t in re.split(r"[\s(){}\[\]:,.;]+", s.lower()) if len(t) > 1]


@app.post("/bounty/prepare-create")
async def prepare_create(body: PrepareCreateBody) -> dict[str, Any]:
    """Return on-chain call args (specHash, amount, deadline, challengeWindow)
    + the BountyFactory + MockUSDC contract addresses so the frontend can
    issue createBounty from the connected wallet without re-implementing
    the spec parser. Validates the spec against on-chain `require` checks
    so we fail fast here rather than burning gas on a sure-revert."""
    try:
        raw = yaml.safe_load(body.spec_yaml)
        if not isinstance(raw, dict):
            raise SpecError("spec_yaml must be a YAML mapping")
        spec = parse_spec(raw)
    except (SpecError, yaml.YAMLError) as e:
        raise HTTPException(status_code=400, detail=f"invalid spec: {e}")
    now = int(time.time())
    if spec.deadline_unix <= now:
        raise HTTPException(
            status_code=400,
            detail=(
                f"deadline_unix ({spec.deadline_unix}) is in the past — "
                f"current_unix_time is {now}. The on-chain createBounty "
                f"would revert with 'deadline past'. Edit the YAML and "
                f"re-prepare."
            ),
        )
    if spec.deadline_unix - now < 60:
        raise HTTPException(
            status_code=400,
            detail=(
                f"deadline_unix ({spec.deadline_unix}) is too tight — "
                f"only {spec.deadline_unix - now}s in the future. "
                f"Set a deadline at least 1 minute out so the wallet "
                f"signing flow doesn't race the contract's deadline check."
            ),
        )
    if spec.bounty_usdc <= 0:
        raise HTTPException(status_code=400, detail="bounty_usdc must be > 0")
    if spec.challenge_window_seconds <= 0:
        raise HTTPException(
            status_code=400, detail="challenge_window_seconds must be > 0",
        )
    h = spec_hash(spec)
    addrs = og_chain.addresses()["contracts"] if og_chain.is_configured() else {}
    return {
        "spec_hash": "0x" + h,
        "amount_usdc": str(spec.bounty_usdc),
        "deadline_unix": spec.deadline_unix,
        "challenge_window_seconds": spec.challenge_window_seconds,
        "bounty_factory": addrs.get("BountyFactory"),
        "mock_usdc": addrs.get("MockUSDC"),
    }


@app.post("/bounty/create")
async def create_bounty(body: CreateBountyBody) -> dict[str, Any]:
    try:
        raw = yaml.safe_load(body.spec_yaml)
        if not isinstance(raw, dict):
            raise SpecError("spec_yaml must be a YAML mapping")
        spec = parse_spec(raw)
    except (SpecError, yaml.YAMLError) as e:
        raise HTTPException(status_code=400, detail=f"invalid spec: {e}")

    h = spec_hash(spec)
    bounty_id = await db.insert_bounty(
        spec_hash=h,
        spec_yaml=body.spec_yaml,
        poster=body.poster_address,
        amount_usdc=str(spec.bounty_usdc),
        deadline_unix=spec.deadline_unix,
        challenge_window_seconds=spec.challenge_window_seconds,
        created_at=int(time.time()),
    )
    if bounty_id is None:
        raise HTTPException(status_code=409, detail="bounty with this spec_hash already exists")

    # Pre-emptive TEE explanation: generate at creation time so every bounty
    # card carries a 2-sentence gloss before the first submission lands.
    # Best-effort; if 0G Compute is down the bounty still creates.
    explanation = await explain_spec(spec)
    if explanation:
        await db.set_bounty_explanation(bounty_id, explanation)
    # Pre-emptive AI rating: novelty + difficulty + Erdős classification.
    # Same 0G Compute client; failure is silent so the create succeeds.
    rating = None
    try:
        prior = await db.latest_bounties(limit=20)
        rating = await rate_spec(spec, prior)
        if rating:
            await db.set_bounty_rating(
                bounty_id,
                novelty=rating["novelty"],
                difficulty=rating["difficulty"],
                erdos_class=rating["erdos_class"],
                reasoning=rating["reasoning"],
            )
    except Exception:
        pass

    onchain_field = None
    if body.tx_hash:
        # Wallet-driven path: client already broadcast the createBounty tx.
        # Fetch the receipt + parse the BountyCreated event for the id.
        try:
            w3 = og_chain.get_w3()
            factory = og_chain.get_factory()
            tx_hash_bytes = bytes.fromhex(body.tx_hash.removeprefix("0x"))
            receipt = await w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=60)
            if int(receipt.get("status", 0)) != 1:
                # Try to recover the revert reason by re-simulating the tx
                # at its block. If unavailable, surface a generic message
                # that points the user at the most likely causes.
                reason = await _recover_revert_reason(w3, body.tx_hash, receipt)
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"on-chain createBounty reverted "
                        f"({reason or 'check deadline > now, allowance ≥ amount, balance ≥ amount'})"
                    ),
                )
            events = factory.events.BountyCreated().process_receipt(receipt)
            if not events:
                raise HTTPException(
                    status_code=400,
                    detail="tx confirmed but did not emit BountyCreated — wrong contract address?",
                )
            onchain_id = int(events[0]["args"]["bountyId"])
            await db.set_bounty_onchain(
                bounty_id,
                onchain_bounty_id=onchain_id,
                tx_hash=body.tx_hash,
            )
            onchain_field = {
                "onchain_bounty_id": onchain_id,
                "tx_hash": body.tx_hash,
                "block_number": receipt["blockNumber"],
                "via": "wallet",
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"tx receipt verification failed: {e}")
    elif publisher.is_configured():
        onchain = await publisher.create_bounty_onchain(
            spec_hash=bytes.fromhex(h),
            amount=spec.bounty_usdc,
            deadline=spec.deadline_unix,
            challenge_window=spec.challenge_window_seconds,
        )
        if onchain is not None:
            await db.set_bounty_onchain(
                bounty_id,
                onchain_bounty_id=onchain.onchain_bounty_id,
                tx_hash=onchain.tx_hash,
            )
            onchain_field = {
                "onchain_bounty_id": onchain.onchain_bounty_id,
                "tx_hash": onchain.tx_hash,
                "block_number": onchain.block_number,
                "via": "operator",
            }

    return {
        "bounty_id": bounty_id,
        "spec_hash": h,
        "status": "open",
        "bounty_usdc": spec.bounty_usdc,
        "deadline_unix": spec.deadline_unix,
        "challenge_window_seconds": spec.challenge_window_seconds,
        "tee_explanation": explanation,
        "rating": rating,
        "onchain": onchain_field,
    }


class SubmitProofBody(BaseModel):
    bounty_id: int
    # solver_address is required when signature is set. When persona_slug is
    # set, the server overrides this with the persona's address.
    solver_address: str | None = None
    proof: str
    upload: bool = True
    explain: bool = True
    # Optional EIP-191 personal_sign over publisher.build_submit_proof_message
    # for `attestation_hash`. When present, on-chain submission goes through
    # BountyFactory.submitProofFor and the recovered address (must equal
    # solver_address) becomes the on-chain solver of record. The server still
    # re-runs the verifier and refuses to relay if accepted=False — so the
    # operator never relays an invalid proof. When omitted, falls back to
    # operator-as-solver via BountyFactory.submitProof.
    signature: str | None = None
    attestation_hash: str | None = None
    # Demo helper: when set to "aggressive-andy" / "careful-carl" / "balanced-bea",
    # the server signs the attestation hash with that persona's stored
    # private key and routes through submitProofFor. Lets the seed script
    # populate races with three distinct on-chain solvers without each
    # persona needing to be a wagmi-connected wallet.
    persona_slug: str | None = None


@app.post("/bounty/submit")
async def submit_proof(body: SubmitProofBody) -> dict[str, Any]:
    bounty = await db.get_bounty(body.bounty_id)
    if bounty is None:
        raise HTTPException(status_code=404, detail="bounty not found")

    private_key = os.getenv("OG_PRIVATE_KEY")
    if not private_key:
        raise HTTPException(status_code=500, detail="OG_PRIVATE_KEY not configured on server")

    raw = yaml.safe_load(bounty["spec_yaml"])
    spec_for_verify = parse_spec(raw)

    result = await verify(spec_for_verify, body.proof)
    unsigned = build_attestation(spec_for_verify, result)
    signed = sign_attestation(unsigned, private_key)

    # Server-side persona shortcut: if persona_slug is set, the server signs
    # the attestation hash with the persona's stored privkey and switches to
    # the submitProofFor relay path. This keeps the demo seeding flow honest
    # (three distinct on-chain solvers) without requiring three connected
    # wagmi wallets.
    persona_signature: str | None = None
    persona_address: str | None = None
    if body.persona_slug:
        persona = next(
            (p for p in personas.get_state()["personas"] if p["slug"] == body.persona_slug),
            None,
        )
        if persona is None or not persona.get("private_key"):
            raise HTTPException(status_code=400, detail=f"unknown persona slug: {body.persona_slug}")
        persona_address = persona["address"]
        if bounty.get("onchain_bounty_id") and publisher.is_configured():
            from eth_account import Account
            from eth_account.messages import encode_defunct
            attest_bytes = bytes.fromhex(signed["attestation_hash"])
            message_hash = publisher.build_submit_proof_message(
                onchain_bounty_id=bounty["onchain_bounty_id"],
                attestation_hash=attest_bytes,
            )
            signed_msg = Account.from_key(persona["private_key"]).sign_message(
                encode_defunct(message_hash)
            )
            persona_signature = "0x" + signed_msg.signature.hex()

    # Resolve effective solver_address + signature precedence:
    # explicit body.signature > persona > operator-as-solver fallback
    effective_solver = body.solver_address
    effective_signature = body.signature
    effective_attestation_hash = body.attestation_hash
    if body.persona_slug and persona_signature:
        effective_solver = persona_address
        effective_signature = persona_signature
        effective_attestation_hash = "0x" + signed["attestation_hash"]
    if effective_solver is None:
        # Final fallback: operator wallet (legacy demo path)
        effective_solver = og_chain.get_account().address

    if effective_signature and not effective_attestation_hash:
        raise HTTPException(
            status_code=400,
            detail="signature requires attestation_hash (the 32-byte hash the solver signed)",
        )

    storage_field = None
    storage_root_hash: str | None = None
    storage_tx_hash: str | None = None
    if body.upload:
        storage = await upload_attestation(signed)
        if storage is not None:
            storage_root_hash = storage.root_hash
            storage_tx_hash = storage.tx_hash
            storage_field = {
                "root_hash": storage.root_hash,
                "tx_hash": storage.tx_hash,
                "uploaded_at": storage.uploaded_at,
            }

    explanation = None
    if body.explain:
        explanation = await explain_verification(spec_for_verify, result)

    now = int(time.time())
    await db.upsert_solver(address=effective_solver, ts=now)
    submission_id = await db.insert_submission(
        bounty_id=body.bounty_id,
        solver_address=effective_solver,
        attestation_hash=signed["attestation_hash"],
        proof_hash=result.proof_hash,
        accepted=result.accepted,
        submitted_at=now,
        storage_root_hash=storage_root_hash,
        storage_tx_hash=storage_tx_hash,
        tee_explanation=explanation,
        kernel_output_hash=signed.get("kernel_output_hash"),
        verifier_mode=result.mode,
        kernel_duration_seconds=result.duration_seconds,
    )
    await db.update_bounty_status(body.bounty_id, "submitted" if result.accepted else "open")

    onchain_field = None
    if result.accepted and bounty.get("onchain_bounty_id") and publisher.is_configured():
        if effective_signature:
            attestation_bytes = bytes.fromhex(effective_attestation_hash.removeprefix("0x"))
            sig = bytes.fromhex(effective_signature.removeprefix("0x"))
            onchain = await publisher.submit_proof_for_onchain(
                onchain_bounty_id=bounty["onchain_bounty_id"],
                attestation_hash=attestation_bytes,
                solver=effective_solver,
                signature=sig,
            )
        else:
            attestation_bytes = bytes.fromhex(signed["attestation_hash"])
            onchain = await publisher.submit_proof_onchain(
                onchain_bounty_id=bounty["onchain_bounty_id"],
                attestation_hash=attestation_bytes,
            )
        if onchain is not None:
            if submission_id is not None:
                await db.set_submission_onchain(submission_id, onchain.tx_hash)
            onchain_field = {
                "tx_hash": onchain.tx_hash,
                "block_number": onchain.block_number,
                "via": "submitProofFor" if effective_signature else "submitProof",
            }

    keeperhub_field = None
    if result.accepted and keeperhub.is_configured():
        workflow_id = os.environ["KEEPERHUB_WORKFLOW_ID"]
        kh_inputs = {
            "bountyId": bounty.get("onchain_bounty_id"),
            "attestationHash": signed["attestation_hash"],
            "solver": effective_solver,
        }
        kh_resp = await keeperhub.execute_oneoff(workflow_id, kh_inputs)
        execution_id = None
        status = "ok" if kh_resp else "skipped"
        if isinstance(kh_resp, dict):
            execution_id = kh_resp.get("executionId") or kh_resp.get("id")
            status = kh_resp.get("status", status)
        await db.insert_kh_execution(
            ts=now,
            bounty_id=body.bounty_id,
            workflow_id=workflow_id,
            execution_id=execution_id,
            status=status,
            error=None if kh_resp is not None else "execute_oneoff returned None",
            inputs_json=json.dumps(kh_inputs),
        )
        keeperhub_field = {
            "execution_id": execution_id,
            "status": status,
        }

    return {
        "attestation": signed,
        "storage": storage_field,
        "explanation": explanation,
        "kernel_output": result.kernel_output,
        "onchain": onchain_field,
        "keeperhub": keeperhub_field,
    }


class PrepareSubmitBody(BaseModel):
    bounty_id: int
    solver_address: str
    proof: str


@app.post("/bounty/submit-prepare")
async def prepare_submit(body: PrepareSubmitBody) -> dict[str, Any]:
    """Run the verifier + build the attestation, return everything the
    frontend needs to issue an EIP-191 personal_sign for the gasless
    submitProofFor flow. Does NOT touch the chain or persist anything."""
    bounty = await db.get_bounty(body.bounty_id)
    if bounty is None:
        raise HTTPException(status_code=404, detail="bounty not found")
    if bounty.get("onchain_bounty_id") is None:
        raise HTTPException(status_code=400, detail="bounty not yet on-chain")
    if not publisher.is_configured():
        raise HTTPException(status_code=503, detail="publisher not configured")

    private_key = os.getenv("OG_PRIVATE_KEY")
    if not private_key:
        raise HTTPException(status_code=500, detail="OG_PRIVATE_KEY not configured")

    raw = yaml.safe_load(bounty["spec_yaml"])
    spec = parse_spec(raw)
    result = await verify(spec, body.proof)
    if not result.accepted:
        return {
            "accepted": False,
            "reason": "verifier rejected the proof",
            "kernel_output": result.kernel_output[:2000],
        }
    unsigned = build_attestation(spec, result)
    signed = sign_attestation(unsigned, private_key)
    attestation_hash = "0x" + signed["attestation_hash"]
    message_hash = publisher.build_submit_proof_message(
        onchain_bounty_id=bounty["onchain_bounty_id"],
        attestation_hash=bytes.fromhex(signed["attestation_hash"]),
    )
    return {
        "accepted": True,
        "attestation_hash": attestation_hash,
        "message_hash": "0x" + message_hash.hex(),
        "onchain_bounty_id": bounty["onchain_bounty_id"],
        "scheme": "EIP-191 personal_sign over message_hash bytes",
    }


@app.get("/bounty/{bounty_id}/submit-message")
async def submit_message(bounty_id: int, attestation_hash: str) -> dict[str, Any]:
    """Return the keccak256 message a solver must EIP-191 personal_sign for
    BountyFactory.submitProofFor. Frontend / external solvers compute the
    attestation hash off-chain, hit this endpoint to get the message, sign,
    then POST /bounty/submit with `signature` set."""
    bounty = await db.get_bounty(bounty_id)
    if bounty is None:
        raise HTTPException(status_code=404, detail="bounty not found")
    if bounty.get("onchain_bounty_id") is None:
        raise HTTPException(status_code=400, detail="bounty not yet on-chain")
    if not publisher.is_configured():
        raise HTTPException(status_code=503, detail="publisher not configured")
    raw = bytes.fromhex(attestation_hash.removeprefix("0x"))
    if len(raw) != 32:
        raise HTTPException(status_code=400, detail="attestation_hash must be 32 bytes hex")
    message_hash = publisher.build_submit_proof_message(
        onchain_bounty_id=bounty["onchain_bounty_id"],
        attestation_hash=raw,
    )
    return {
        "onchain_bounty_id": bounty["onchain_bounty_id"],
        "attestation_hash": "0x" + raw.hex(),
        "message_hash": "0x" + message_hash.hex(),
        "scheme": "EIP-191 personal_sign over message_hash",
    }


@app.get("/bounty/{bounty_id}/status")
async def bounty_status(bounty_id: int) -> dict[str, Any]:
    bounty = await db.get_bounty(bounty_id)
    if bounty is None:
        raise HTTPException(status_code=404, detail="bounty not found")
    submissions = await db.submissions_for_bounty(bounty_id)
    return {"bounty": bounty, "submissions": submissions}


@app.get("/bounty/{bounty_id}/race-events")
async def bounty_race_events(bounty_id: int, since: int = 0) -> dict[str, Any]:
    """Stream of race events the dashboard plays back to drive the cars.

    Events with a `ts` in the future (e.g. scripted seed-race rows that
    haven't "happened" yet) are withheld until their timestamp arrives.
    This makes a 90-second seeded race actually take 90 seconds to play
    out, instead of fast-forwarding to the finish on the first poll.
    """
    bounty = await db.get_bounty(bounty_id)
    if bounty is None:
        raise HTTPException(status_code=404, detail="bounty not found")
    now_ts = int(time.time())
    events = await db.race_events_for_bounty(bounty_id, since_ts=since)
    events = [e for e in events if e["ts"] <= now_ts]
    return {"events": events, "now": now_ts}


@app.post("/bounty/{bounty_id}/restart-race")
async def restart_race(bounty_id: int, duration: int = 180) -> dict[str, Any]:
    """Wipe + re-seed the demo race events with `now` as the timeline origin.
    The dashboard's "restart race" button calls this so the user can replay
    the visualization without dropping back into a CLI."""
    bounty = await db.get_bounty(bounty_id)
    if bounty is None:
        raise HTTPException(status_code=404, detail="bounty not found")

    from cli.ascertainty import _run_seed_race
    import argparse
    ns = argparse.Namespace(bounty_id=bounty_id, solvers=3, duration=duration)
    rc = await _run_seed_race(ns)
    if rc != 0:
        raise HTTPException(status_code=500, detail="seed failed")
    return {"ok": True, "duration": duration, "starts_at": int(time.time())}


@app.get("/leaderboard")
async def leaderboard(limit: int = 20) -> dict[str, Any]:
    return {"solvers": await db.leaderboard(limit=limit)}


@app.get("/agent/status")
async def agent_status() -> dict[str, Any]:
    """Snapshot of the agent's iNFT identity, deployed contracts,
    0G Storage / Compute / KeeperHub configuration. Powers the
    dashboard's agent status panel."""
    addresses = og_chain.addresses() if og_chain.is_configured() else None
    kh_recent = await db.latest_kh_executions(limit=5)
    return {
        "inft": inft.get_state(),
        "chain": addresses,
        "operator": og_chain.get_account().address if og_chain.is_configured() else None,
        "storage": {
            "configured": og_storage.is_configured(),
        },
        "keeperhub": {
            "configured": keeperhub.is_configured(),
            "recent_executions": kh_recent,
        },
    }


async def _persona_payload(p: dict[str, Any], operator_address: str) -> dict[str, Any]:
    """Shared persona-card payload: omits private_key, joins live on-chain
    reputation + DB-derived stats + earned + worn badges. Used by both the
    GET /agent/personas roster and the POST /agent/personas/{slug}/wear
    response so the frontend can update the card without a second roundtrip."""
    addr = p.get("address")
    reputation = 0
    solved = 0
    if og_chain.is_configured() and addr:
        try:
            registry = og_chain.get_registry()
            reputation = int(await registry.functions.reputation(addr).call())
            solved = int(await registry.functions.solvedCount(addr).call())
        except Exception:
            pass

    # Live stats from DB
    submission_stats = await db.solver_submission_stats(addr) if addr else {}
    earned_badges = await badges.compute_badges(
        address=addr or "0x0", operator_address=operator_address,
    ) if addr else []

    # `wearing_badges` empty list means "wear all earned" (default for
    # freshly-minted personas). Operator can override via POST /wear.
    worn_slugs = p.get("wearing_badges") or [b["slug"] for b in earned_badges]
    return {
        "slug": p["slug"],
        "name": p["name"],
        "emoji": p["emoji"],
        "color": p["color"],
        "tagline": p["tagline"],
        "profile": p["profile"],
        "axiom_breadth": p["axiom_breadth"],
        "address": addr,
        "token_id": p.get("token_id"),
        "storage_root_hash": p.get("storage_root_hash"),
        "descriptor": p.get("descriptor"),
        "version": p.get("version"),
        "minted_at": p.get("minted_at"),
        "reputation": reputation,
        "solved_count": solved,
        "stats": submission_stats,
        "earned_badges": earned_badges,
        "worn_badges": worn_slugs,
    }


@app.get("/agent/personas")
async def agent_personas() -> dict[str, Any]:
    """Persona iNFT roster + live stats + earned/worn GitHub-style badges."""
    state = personas.get_state()
    operator_address = (
        og_chain.get_account().address if og_chain.is_configured() else "0x0"
    )
    out = []
    for p in state["personas"]:
        out.append(await _persona_payload(p, operator_address))
    return {
        "configured": state["configured"],
        "personas": out,
        "badge_catalog": badges.all_rules(),
    }


class WearBadgesBody(BaseModel):
    badges: list[str]


@app.post("/agent/personas/{slug}/wear")
async def set_persona_wearing(slug: str, body: WearBadgesBody) -> dict[str, Any]:
    """Curate which badges the persona displays on its card. Pass an empty
    list to reset to 'wear all earned'. No auth gate in the demo build —
    in production this would require a signature from the persona's privkey."""
    if not personas.set_wearing(slug, body.badges):
        raise HTTPException(status_code=404, detail="persona not found")
    p = personas.get_persona_by_slug(slug)
    operator_address = (
        og_chain.get_account().address if og_chain.is_configured() else "0x0"
    )
    return await _persona_payload(p, operator_address)


# ---------- atlas (cosmos view backing data) ----------

@app.get("/atlas/models")
async def atlas_models_endpoint() -> dict[str, Any]:
    rows = await db.atlas_models()
    return {"models": rows, "count": len(rows)}


@app.get("/atlas/markets")
async def atlas_markets_endpoint() -> dict[str, Any]:
    rows = await db.atlas_markets()
    return {"markets": rows, "count": len(rows)}


@app.get("/atlas/connections")
async def atlas_connections_endpoint() -> dict[str, Any]:
    rows = await db.atlas_connections()
    return {"connections": rows, "count": len(rows)}


@app.post("/atlas/refresh")
async def atlas_refresh_endpoint() -> dict[str, Any]:
    """Trigger a one-shot ingest. Idempotent. Models from the curated
    snapshot, markets from Polymarket public CLOB. UMAP recomputed
    after ingestion in a follow-up endpoint (not yet wired)."""
    from backend.atlas import ingest_models, ingest_polymarket
    n_models = await ingest_models.ingest_once()
    n_markets = await ingest_polymarket.ingest_once()
    return {"models": n_models, "markets": n_markets}



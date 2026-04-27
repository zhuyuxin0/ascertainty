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
    cctp_watcher,
    claim_task,
    db,
    inft,
    keeperhub,
    og_chain,
    og_storage,
    publisher,
    telegram_bot,
    watcher,
)
from backend.attestation import build_attestation, sign_attestation
from backend.og_compute import explain_verification
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
        # iNFT mint runs once at startup, idempotent. Best-effort.
        _tasks.append(asyncio.create_task(inft.init(), name="inft_init"))
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

    onchain_field = None
    if publisher.is_configured():
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
            }

    return {
        "bounty_id": bounty_id,
        "spec_hash": h,
        "status": "open",
        "bounty_usdc": spec.bounty_usdc,
        "deadline_unix": spec.deadline_unix,
        "challenge_window_seconds": spec.challenge_window_seconds,
        "onchain": onchain_field,
    }


class SubmitProofBody(BaseModel):
    bounty_id: int
    solver_address: str
    proof: str
    upload: bool = True
    explain: bool = True


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
    await db.upsert_solver(address=body.solver_address, ts=now)
    submission_id = await db.insert_submission(
        bounty_id=body.bounty_id,
        solver_address=body.solver_address,
        attestation_hash=signed["attestation_hash"],
        proof_hash=result.proof_hash,
        accepted=result.accepted,
        submitted_at=now,
        storage_root_hash=storage_root_hash,
        storage_tx_hash=storage_tx_hash,
        tee_explanation=explanation,
        kernel_output_hash=signed.get("kernel_output_hash"),
        verifier_mode=result.mode,
    )
    await db.update_bounty_status(body.bounty_id, "submitted" if result.accepted else "open")

    onchain_field = None
    if result.accepted and bounty.get("onchain_bounty_id") and publisher.is_configured():
        onchain = await publisher.submit_proof_onchain(
            onchain_bounty_id=bounty["onchain_bounty_id"],
            attestation_hash=bytes.fromhex(signed["attestation_hash"]),
        )
        if onchain is not None:
            if submission_id is not None:
                await db.set_submission_onchain(submission_id, onchain.tx_hash)
            onchain_field = {
                "tx_hash": onchain.tx_hash,
                "block_number": onchain.block_number,
            }

    keeperhub_field = None
    if result.accepted and keeperhub.is_configured():
        workflow_id = os.environ["KEEPERHUB_WORKFLOW_ID"]
        kh_inputs = {
            "bountyId": bounty.get("onchain_bounty_id"),
            "attestationHash": signed["attestation_hash"],
            "solver": body.solver_address,
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



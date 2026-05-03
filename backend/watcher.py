"""On-chain BountyFactory event watcher (polling).

0G Galileo's WebSocket endpoint isn't reliable enough for streaming, so
this is a polling watcher: every WATCH_INTERVAL_SECONDS, fetch logs from
`last_block_processed + 1` to `current_block` and process them. The
high-water mark lives in the `watcher_state` table so restarts resume
without reprocessing or losing events.

Events handled:
  BountyCreated   — UPSERT bounty row (link onchain_bounty_id to spec_hash)
  ProofSubmitted  — record submission, mark bounty.status = 'submitted'
  ProofChallenged — mark bounty.status = 'challenged'
  BountySettled   — mark bounty.status = 'settled', bump solver reputation,
                    record the keeper (msg.sender) that drove settlement
  BountyClaimed   — legacy event still emitted alongside BountySettled for
                    indexer back-compat; ignored here to avoid double-count
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

from backend import db, og_chain

log = logging.getLogger("ascertainty.watcher")

WATCH_INTERVAL_SECONDS = float(os.getenv("ASCERTAINTY_WATCH_INTERVAL", "5"))
WATCH_KEY = "last_block_processed"
WATCH_LOOKBACK_BLOCKS = 500          # if no checkpoint, start from this far behind tip
MAX_BLOCKS_PER_BATCH = 5000          # cap a single get_logs window


async def watcher_task() -> None:
    if not og_chain.is_configured():
        log.info("watcher: og_chain not configured, skipping")
        return

    factory = og_chain.get_factory()
    w3 = og_chain.get_w3()

    log.info("watcher: starting; interval=%.1fs address=%s",
             WATCH_INTERVAL_SECONDS, factory.address)

    while True:
        try:
            current_block = await w3.eth.block_number
            checkpoint_str = await db.get_watcher_state(WATCH_KEY)
            if checkpoint_str is None:
                from_block = max(0, current_block - WATCH_LOOKBACK_BLOCKS)
                log.info("watcher: no checkpoint, starting at block %s (lookback %s)",
                         from_block, WATCH_LOOKBACK_BLOCKS)
            else:
                from_block = int(checkpoint_str) + 1

            if from_block > current_block:
                await asyncio.sleep(WATCH_INTERVAL_SECONDS)
                continue

            to_block = min(current_block, from_block + MAX_BLOCKS_PER_BATCH - 1)

            await _process_window(factory, from_block, to_block)
            await db.set_watcher_state(WATCH_KEY, str(to_block))

        except asyncio.CancelledError:
            log.info("watcher: cancelled")
            raise
        except Exception as e:
            log.warning("watcher: poll error: %s", e)

        await asyncio.sleep(WATCH_INTERVAL_SECONDS)


async def _process_window(factory, from_block: int, to_block: int) -> None:
    total = 0
    # Fetch each event type separately — web3.py decodes them for us
    for created in await factory.events.BountyCreated.get_logs(from_block=from_block, to_block=to_block):
        await _handle_bounty_created(created)
        total += 1
    for submitted in await factory.events.ProofSubmitted.get_logs(from_block=from_block, to_block=to_block):
        await _handle_proof_submitted(submitted)
        total += 1
    for challenged in await factory.events.ProofChallenged.get_logs(from_block=from_block, to_block=to_block):
        await _handle_proof_challenged(challenged)
        total += 1
    for settled in await factory.events.BountySettled.get_logs(from_block=from_block, to_block=to_block):
        await _handle_bounty_settled(settled)
        total += 1
    if total:
        log.info("watcher: processed %d events in blocks %s-%s", total, from_block, to_block)


# ---------- event handlers ----------

async def _handle_bounty_created(ev) -> None:
    args = ev["args"]
    onchain_id = int(args["bountyId"])
    spec_hash_hex = args["specHash"].hex().removeprefix("0x")
    tx_hash = ev["transactionHash"].hex()

    existing = await db.get_bounty_by_spec_hash(spec_hash_hex)
    if existing is not None:
        if existing.get("onchain_bounty_id") != onchain_id:
            await db.set_bounty_onchain(
                existing["id"],
                onchain_bounty_id=onchain_id,
                tx_hash=tx_hash,
            )
            log.info("watcher: BountyCreated linked off-chain id=%s -> on-chain id=%s",
                     existing["id"], onchain_id)
        return

    # Off-chain row didn't exist (e.g. bounty created via REPL, not API). Materialize it.
    await db.insert_bounty(
        spec_hash=spec_hash_hex,
        spec_yaml="",  # unknown; off-chain context missing
        poster=args["poster"],
        amount_usdc=str(int(args["amount"])),
        deadline_unix=int(args["deadline"]),
        challenge_window_seconds=int(args["challengeWindow"]),
        created_at=int(time.time()),
        onchain_bounty_id=onchain_id,
        tx_hash=tx_hash,
    )
    log.info("watcher: BountyCreated materialized on-chain id=%s spec=%s...",
             onchain_id, spec_hash_hex[:12])
    new_bounty = await db.get_bounty_by_onchain_id(onchain_id)
    if new_bounty:
        from backend import telegram_bot
        await telegram_bot.broadcast_bounty_created(new_bounty)


async def _handle_proof_submitted(ev) -> None:
    args = ev["args"]
    onchain_id = int(args["bountyId"])
    solver = args["solver"]
    bounty = await db.get_bounty_by_onchain_id(onchain_id)
    if bounty is None:
        log.info("watcher: ProofSubmitted for unknown on-chain id=%s, skipping", onchain_id)
        return
    await db.update_bounty_status(bounty["id"], "submitted")
    log.info("watcher: ProofSubmitted on-chain id=%s solver=%s", onchain_id, solver)
    # Synthesize a race for the dashboard: progress events spread across
    # the challenge window so the car visibly drives from spawn → near-finish
    # over the same period the bounty is on-chain "submitted".
    await _emit_synthetic_race(bounty, solver)


async def _handle_proof_challenged(ev) -> None:
    args = ev["args"]
    onchain_id = int(args["bountyId"])
    challenger = args["challenger"]
    bounty = await db.get_bounty_by_onchain_id(onchain_id)
    if bounty is None:
        return
    await db.update_bounty_status(bounty["id"], "challenged")
    log.info("watcher: ProofChallenged on-chain id=%s challenger=%s", onchain_id, challenger)
    # Pit the cars currently racing on this bounty
    submissions = await db.submissions_for_bounty(bounty["id"])
    now = int(time.time())
    for sub in submissions:
        await db.insert_race_event(
            bounty_id=bounty["id"],
            solver_address=sub["solver_address"],
            event_type="pit",
            data_json='{"reason": "challenged"}',
            ts=now,
        )


async def _handle_bounty_settled(ev) -> None:
    """BountySettled fires from settleBounty (permissionless keeper path)
    and from claimBounty (solver-initiated path). msg.sender is the
    `settler` — could be the operator wallet, KeeperHub's hosted Turnkey
    wallet, the solver themselves, or any third-party keeper. The solver
    of record (and the USDC recipient) is `solver`; that's what we credit
    on the leaderboard regardless of who paid gas to drive settlement."""
    import json as _json
    args = ev["args"]
    onchain_id = int(args["bountyId"])
    solver = args["solver"]
    settler = args["settler"]
    amount = int(args["amount"])
    bounty = await db.get_bounty_by_onchain_id(onchain_id)
    if bounty is None:
        return
    await db.update_bounty_status(bounty["id"], "settled")
    await db.upsert_solver(address=solver, ts=int(time.time()))
    await db.increment_solver_reputation(solver, delta=1)
    log.info("watcher: BountySettled on-chain id=%s solver=%s amount=%s settler=%s",
             onchain_id, solver, amount, settler)
    # Mark the race finished — finish event lands at the moment of on-chain
    # settlement, which is the moment the USDC moves. The dashboard's race
    # engine uses this to play the finish-line burst synced to real settlement.
    await db.insert_race_event(
        bounty_id=bounty["id"],
        solver_address=solver,
        event_type="finish",
        data_json=_json.dumps({
            "final_amount_usdc": amount,
            "settler": settler,
            "tx_hash": ev["transactionHash"].hex(),
        }),
        ts=int(time.time()),
    )
    from backend import telegram_bot
    await telegram_bot.broadcast_bounty_claimed(bounty, solver, amount)


async def _emit_synthetic_race(bounty: dict, solver: str, num_steps: int = 12) -> None:
    """When a real ProofSubmitted event is observed, emit a series of
    `progress` race events spread across the bounty's challenge window so
    the dashboard /race/<id> page shows continuous motion until the
    on-chain BountyClaimed event arrives and triggers the `finish`.

    Idempotent guard: if we've already emitted progress events for this
    (bounty, solver) pair, skip — prevents replays from doubling events
    when the watcher backfills.
    """
    bounty_id = bounty["id"]
    challenge_window = max(10, int(bounty.get("challenge_window_seconds", 30)))
    now = int(time.time())

    # Idempotency: don't emit if there's already a progress event for this
    # solver on this bounty.
    existing = await db.race_events_for_bounty(bounty_id, since_ts=0)
    for e in existing:
        if e["solver_address"] == solver and e["event_type"] == "progress":
            log.info("watcher: race already emitted for bounty=%s solver=%s, skipping",
                     bounty_id, solver)
            return

    # Spread progress events from now → now + challenge_window, ramping
    # fraction from 0.05 to 0.92 (we leave the final 0.08 for the finish
    # event from BountyClaimed).
    import json as _json
    for i in range(1, num_steps + 1):
        ts = now + int(i * challenge_window / num_steps)
        fraction = 0.05 + (0.87 * i / num_steps)
        await db.insert_race_event(
            bounty_id=bounty_id,
            solver_address=solver,
            event_type="progress",
            data_json=_json.dumps({"checkpoint": i, "fraction": round(fraction, 4)}),
            ts=ts,
        )
    log.info("watcher: synthesized %d race events for bounty=%s solver=%s over %ds",
             num_steps, bounty_id, solver[:10], challenge_window)

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
  BountyClaimed   — mark bounty.status = 'settled', bump solver reputation
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
    for claimed in await factory.events.BountyClaimed.get_logs(from_block=from_block, to_block=to_block):
        await _handle_bounty_claimed(claimed)
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


async def _handle_proof_submitted(ev) -> None:
    args = ev["args"]
    onchain_id = int(args["bountyId"])
    bounty = await db.get_bounty_by_onchain_id(onchain_id)
    if bounty is None:
        log.info("watcher: ProofSubmitted for unknown on-chain id=%s, skipping", onchain_id)
        return
    await db.update_bounty_status(bounty["id"], "submitted")
    log.info("watcher: ProofSubmitted on-chain id=%s solver=%s",
             onchain_id, args["solver"])


async def _handle_proof_challenged(ev) -> None:
    args = ev["args"]
    onchain_id = int(args["bountyId"])
    bounty = await db.get_bounty_by_onchain_id(onchain_id)
    if bounty is None:
        return
    await db.update_bounty_status(bounty["id"], "challenged")
    log.info("watcher: ProofChallenged on-chain id=%s challenger=%s",
             onchain_id, args["challenger"])


async def _handle_bounty_claimed(ev) -> None:
    args = ev["args"]
    onchain_id = int(args["bountyId"])
    bounty = await db.get_bounty_by_onchain_id(onchain_id)
    if bounty is None:
        return
    await db.update_bounty_status(bounty["id"], "settled")
    await db.upsert_solver(address=args["solver"], ts=int(time.time()))
    await db.increment_solver_reputation(args["solver"], delta=1)
    log.info("watcher: BountyClaimed on-chain id=%s solver=%s amount=%s",
             onchain_id, args["solver"], int(args["amount"]))

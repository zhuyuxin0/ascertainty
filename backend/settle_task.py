"""Permissionless settlement keeper.

Replaces the old per-persona `claim_task`. Periodically scans the DB for
bounties whose challenge window has expired since their accepted
submission, then drives `BountyFactory.settleBounty(bountyId)` —
permissionless on-chain, so msg.sender doesn't have to be the solver.

The settler can be any of:
  1. KeeperHub-hosted Turnkey wallet (preferred when KEEPERHUB_WORKFLOW_ID
     is configured) — we trigger the workflow via MCP `execute_workflow`
     with `{"bountyId": <id>}` and KH's wallet pays gas + signs the tx
     against chain 16602.
  2. Operator wallet via web3.py (fallback when KH isn't configured, the
     workflow execution fails, or the workflow is set to dry-run mode).

The on-chain `settleBounty` is idempotent — duplicate calls revert with
"not settleable" once a bounty is in `Status.Settled`. So a brief race
between the KH wallet and the operator-fallback path is harmless: the
slower one reverts cheaply, the watcher sees a single `BountySettled`
either way and drives the dashboard.

USDC is transferred to the *recorded solver* (committed at submission
time), never to msg.sender. Settlement infrastructure is therefore
decoupled from solver custody — solvers don't need to be online and
operators can never divert payouts.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time

import aiosqlite

from backend import db, keeperhub, og_chain, publisher

log = logging.getLogger("ascertainty.settle")

SETTLE_INTERVAL_SECONDS = float(os.getenv("ASCERTAINTY_SETTLE_INTERVAL", "30"))
KH_TIMEOUT_SECONDS = float(os.getenv("ASCERTAINTY_KH_SETTLE_TIMEOUT", "60"))


async def settle_task() -> None:
    if not og_chain.is_configured():
        log.info("settle: og_chain not configured, skipping")
        return

    log.info(
        "settle: starting; interval=%.1fs kh_configured=%s",
        SETTLE_INTERVAL_SECONDS, keeperhub.is_configured(),
    )

    while True:
        try:
            now = int(time.time())
            for due in await _due_for_settle(now):
                await _settle_one(due, now)
        except asyncio.CancelledError:
            log.info("settle: cancelled")
            raise
        except Exception as e:
            log.warning("settle: poll error: %s", e)

        await asyncio.sleep(SETTLE_INTERVAL_SECONDS)


async def _settle_one(due: dict, now: int) -> None:
    """Drive one settlement. Tries KeeperHub first (production architecture
    — the platform-grade keeper is KH's hosted Turnkey wallet), falls back
    to the operator wallet so settlements never stall on KH downtime.

    Resilient to factory redeploys: before triggering, reads the current
    on-chain bounty status. If it's not in `Submitted` state (e.g., the
    DB row references an old factory's bountyId, or a previous cycle
    already settled it), we archive it locally and return without firing
    KH or wasting operator gas."""
    onchain_id = due["onchain_bounty_id"]
    solver = due.get("solver_address")

    # Pre-flight: confirm the bounty exists in Submitted state on the
    # CURRENT factory. Status enum: 0=Open, 1=Submitted, 2=Challenged,
    # 3=Settled, 4=Cancelled.
    try:
        factory = og_chain.get_factory()
        b = await factory.functions.bounties(onchain_id).call()
        onchain_status = int(b[5])  # status field index in the struct
        if onchain_status != 1:
            log.info(
                "settle: bounty id=%s onchain status=%s (not Submitted) — "
                "archiving locally to stop re-triggering",
                onchain_id, onchain_status,
            )
            new_status = {
                0: "archived",   # never made it to Submitted on this factory
                2: "challenged",
                3: "settled",
                4: "cancelled",
            }.get(onchain_status, "archived")
            await db.update_bounty_status(due["id"], new_status)
            return
    except Exception as e:
        log.warning("settle: pre-flight read failed for id=%s: %s", onchain_id, e)
        # Fall through and let the on-chain call surface the real error.

    # ---- preferred path: KeeperHub workflow on chain 16602 ----
    if keeperhub.is_configured():
        workflow_id = os.environ["KEEPERHUB_WORKFLOW_ID"]
        kh_inputs = {
            "bountyId": onchain_id,
            "solver": solver,
        }
        log.info(
            "settle: KH execute_workflow id=%s onchain_id=%s solver=%s",
            workflow_id, onchain_id, solver,
        )
        try:
            kh_resp = await asyncio.wait_for(
                keeperhub.execute_oneoff(workflow_id, kh_inputs),
                timeout=KH_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            kh_resp = None
            log.warning("settle: KH execute_workflow timed out after %ss", KH_TIMEOUT_SECONDS)

        execution_id = None
        kh_status = "accepted" if kh_resp else "failed"
        kh_error = None if kh_resp else "execute_oneoff returned None or timed out"
        if isinstance(kh_resp, dict):
            execution_id = kh_resp.get("executionId") or kh_resp.get("id")
            kh_status = kh_resp.get("status", kh_status)

        await db.insert_kh_execution(
            ts=now,
            bounty_id=due["id"],
            workflow_id=workflow_id,
            execution_id=execution_id,
            status=kh_status,
            error=kh_error,
            inputs_json=json.dumps(kh_inputs),
        )

        # KH workflows complete asynchronously. The MCP execute_workflow
        # call returns immediately with status=running once the trigger
        # has been accepted; the actual on-chain tx lands a few seconds
        # later. So we treat any non-error response as "KH took it" and
        # let the watcher detect BountySettled. Only true failures fall
        # back to the operator wallet.
        accepted_statuses = (
            "ok", "completed", "succeeded", "accepted", "running", "pending"
        )
        if kh_status in accepted_statuses:
            await db.update_bounty_status(due["id"], "settling")
            return
        log.warning(
            "settle: KH workflow failed (status=%s) — falling back to operator",
            kh_status,
        )

    # ---- fallback: operator wallet drives the same on-chain function ----
    result = await publisher.settle_bounty_onchain(onchain_bounty_id=onchain_id)
    if result is not None:
        log.info(
            "settle: operator-fallback settleBounty success tx=%s id=%s solver=%s",
            result.tx_hash, onchain_id, solver,
        )
        # watcher will mark 'settled' when it sees the event; we set
        # 'settling' so the next pass doesn't double-fire.
        await db.update_bounty_status(due["id"], "settling")


async def _due_for_settle(now: int) -> list[dict]:
    """Bounties whose latest accepted submission is past the challenge
    window and which haven't already entered the settling/settled lifecycle."""
    async with db._conn() as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            """SELECT b.id, b.onchain_bounty_id, b.challenge_window_seconds,
                      MAX(s.submitted_at) AS last_submitted_at,
                      (
                          SELECT solver_address
                          FROM submissions
                          WHERE bounty_id = b.id AND accepted = 1
                          ORDER BY submitted_at DESC LIMIT 1
                      ) AS solver_address
               FROM bounties b
               JOIN submissions s ON s.bounty_id = b.id
               WHERE b.status = 'submitted'
                 AND s.accepted = 1
                 AND b.onchain_bounty_id IS NOT NULL
               GROUP BY b.id
               HAVING (? - last_submitted_at) > b.challenge_window_seconds""",
            (now,),
        ) as cur:
            return [dict(r) for r in await cur.fetchall()]

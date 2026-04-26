"""Auto-claim background task.

Periodically scans the DB for bounties whose challenge window has expired
since their successful submission, and posts `claimBounty` on-chain to
settle them. The watcher (separately) listens for the resulting
`BountyClaimed` event and flips the DB status to 'settled' — so this task
only needs to fire-and-log; if the on-chain call succeeds, idempotent
duplicate claims (e.g. KeeperHub also claimed) just revert harmlessly.

Lives off-chain because BountyFactory has no automated keeper hook; in
production this responsibility moves to the KeeperHub workflow. We run
both in the demo to show two paths to settlement.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time

import aiosqlite

from backend import db, og_chain, publisher

log = logging.getLogger("ascertainty.claim")

CLAIM_INTERVAL_SECONDS = float(os.getenv("ASCERTAINTY_CLAIM_INTERVAL", "30"))


async def claim_task() -> None:
    if not og_chain.is_configured():
        log.info("claim: og_chain not configured, skipping")
        return

    log.info("claim: starting; interval=%.1fs", CLAIM_INTERVAL_SECONDS)

    while True:
        try:
            now = int(time.time())
            for due in await _due_for_claim(now):
                onchain_id = due["onchain_bounty_id"]
                log.info("claim: posting claimBounty for on-chain id=%s", onchain_id)
                result = await publisher.claim_bounty_onchain(onchain_bounty_id=onchain_id)
                if result is not None:
                    log.info("claim: claimBounty success tx=%s id=%s",
                             result.tx_hash, onchain_id)
                    # mark settled locally even before watcher catches the event
                    await db.update_bounty_status(due["id"], "settled")
        except asyncio.CancelledError:
            log.info("claim: cancelled")
            raise
        except Exception as e:
            log.warning("claim: poll error: %s", e)

        await asyncio.sleep(CLAIM_INTERVAL_SECONDS)


async def _due_for_claim(now: int) -> list[dict]:
    """Return bounties whose latest accepted submission is past the challenge window."""
    async with db._conn() as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            """SELECT b.*, MAX(s.submitted_at) AS last_submitted_at
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

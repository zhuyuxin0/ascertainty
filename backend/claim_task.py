"""Auto-claim background task.

Periodically scans the DB for bounties whose challenge window has expired
since their successful submission, and posts `claimBounty` on-chain to
settle them. The on-chain `claimBounty` requires `msg.sender == solver`,
so when the solver is one of our minted personas, we sign the claim from
that persona's stored privkey (topping up gas first if needed). When the
solver is the operator wallet (legacy seed flow), we use the operator
key directly.

The watcher listens for the resulting `BountyClaimed` event and flips
the DB status to 'settled' — duplicate claims revert harmlessly.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time

import aiosqlite

from backend import db, og_chain, personas, publisher

log = logging.getLogger("ascertainty.claim")

CLAIM_INTERVAL_SECONDS = float(os.getenv("ASCERTAINTY_CLAIM_INTERVAL", "30"))
PERSONA_GAS_TOP_UP_WEI = 5_000_000_000_000_000  # 0.005 OG, enough for one claim


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
                solver = due.get("solver_address")
                persona = personas.get_persona_by_address(solver) if solver else None

                if persona and persona.get("private_key"):
                    log.info(
                        "claim: posting claimBounty for on-chain id=%s as persona %s",
                        onchain_id, persona["slug"],
                    )
                    result = await _claim_with_key(
                        onchain_bounty_id=onchain_id,
                        private_key=persona["private_key"],
                        ensure_gas=True,
                    )
                else:
                    log.info("claim: posting claimBounty for on-chain id=%s as operator", onchain_id)
                    result = await publisher.claim_bounty_onchain(onchain_bounty_id=onchain_id)

                if result is not None:
                    log.info(
                        "claim: claimBounty success tx=%s id=%s solver=%s",
                        result.tx_hash, onchain_id, solver,
                    )
                    await db.update_bounty_status(due["id"], "settled")
        except asyncio.CancelledError:
            log.info("claim: cancelled")
            raise
        except Exception as e:
            log.warning("claim: poll error: %s", e)

        await asyncio.sleep(CLAIM_INTERVAL_SECONDS)


async def _claim_with_key(
    *, onchain_bounty_id: int, private_key: str, ensure_gas: bool,
):
    """claimBounty signed by the persona's privkey. Tops up the persona's
    gas balance from the operator wallet first if it's running low."""
    from eth_account import Account
    persona_acct = Account.from_key(private_key)
    w3 = og_chain.get_w3()
    factory = og_chain.get_factory()

    if ensure_gas:
        bal = await w3.eth.get_balance(persona_acct.address)
        if bal < PERSONA_GAS_TOP_UP_WEI // 2:
            try:
                operator = og_chain.get_account()
                chain_id = await og_chain.get_chain_id()
                nonce = await w3.eth.get_transaction_count(operator.address, "pending")
                gas_price = await w3.eth.gas_price
                drip = {
                    "from": operator.address,
                    "to": persona_acct.address,
                    "value": PERSONA_GAS_TOP_UP_WEI,
                    "nonce": nonce,
                    "gasPrice": gas_price,
                    "chainId": chain_id,
                    "gas": 21000,
                }
                signed = operator.sign_transaction(drip)
                tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
                await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
                log.info("claim: gas top-up to persona %s tx=%s", persona_acct.address, tx_hash.hex())
            except Exception as e:
                log.warning("claim: gas top-up failed: %s", e)

    try:
        chain_id = await og_chain.get_chain_id()
        nonce = await w3.eth.get_transaction_count(persona_acct.address, "pending")
        gas_price = await w3.eth.gas_price
        fn = factory.functions.claimBounty(onchain_bounty_id)
        tx = await fn.build_transaction({
            "from": persona_acct.address,
            "nonce": nonce,
            "gasPrice": gas_price,
            "chainId": chain_id,
        })
        signed = persona_acct.sign_transaction(tx)
        tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] != 1:
            log.warning("claim: persona claim reverted tx=%s", tx_hash.hex())
            return None
        return type("R", (), {"tx_hash": tx_hash.hex(), "block_number": receipt["blockNumber"]})()
    except Exception as e:
        log.warning("claim: persona claimBounty failed: %s", e)
        return None


async def _due_for_claim(now: int) -> list[dict]:
    """Return bounties whose latest accepted submission is past the challenge
    window, plus the latest solver_address so we know which key to claim with."""
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

"""On-chain publisher for BountyFactory.

Three operations: createBounty (operator escrows USDC), submitProof (post
attestation hash), claimBounty (after challenge window, operator-as-solver
collects USDC). All three share the same lock + live-nonce + live-gasPrice
+ sign + send + wait + parse-events pattern, ported from
`enstabler/agent/publisher.py`.

The lock serializes all writes from this process so we never race a nonce
against ourselves. Live nonce + gas price every call keeps us robust to
external wallets touching the same key.
"""
from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any, Optional

from backend import og_chain

log = logging.getLogger("ascertainty.publisher")

_lock = asyncio.Lock()
_send_timeout = float(os.getenv("ASCERTAINTY_TX_TIMEOUT", "120"))


@dataclass(frozen=True)
class OnchainTxResult:
    tx_hash: str
    block_number: int
    onchain_bounty_id: Optional[int] = None


def is_configured() -> bool:
    return og_chain.is_configured()


async def _send_tx(fn) -> tuple[str, int, Any]:
    """Build, sign, send, wait — return (tx_hash, block_number, receipt).

    Caller passes a contract function call object (e.g. factory.functions.foo(...)).
    """
    w3 = og_chain.get_w3()
    account = og_chain.get_account()
    chain_id = await og_chain.get_chain_id()

    nonce = await w3.eth.get_transaction_count(account.address, "pending")
    gas_price = await w3.eth.gas_price

    tx = await fn.build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gasPrice": gas_price,
        "chainId": chain_id,
    })
    signed = account.sign_transaction(tx)
    tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=_send_timeout)
    return tx_hash.hex(), receipt["blockNumber"], receipt


async def create_bounty_onchain(
    *,
    spec_hash: bytes,
    amount: int,
    deadline: int,
    challenge_window: int,
) -> Optional[OnchainTxResult]:
    """BountyFactory.createBounty. Returns onchain_bounty_id parsed from event."""
    if not is_configured():
        log.info("publisher: not configured, skipping create")
        return None
    if len(spec_hash) != 32:
        raise ValueError(f"spec_hash must be 32 bytes, got {len(spec_hash)}")

    factory = og_chain.get_factory()
    try:
        async with _lock:
            fn = factory.functions.createBounty(spec_hash, amount, deadline, challenge_window)
            tx_hash, block_number, receipt = await _send_tx(fn)

        # parse BountyCreated event for the new bountyId
        events = factory.events.BountyCreated().process_receipt(receipt)
        bounty_id = int(events[0]["args"]["bountyId"]) if events else None
        log.info(
            "publisher: createBounty -> tx=%s bountyId=%s block=%s",
            tx_hash, bounty_id, block_number,
        )
        return OnchainTxResult(tx_hash=tx_hash, block_number=block_number, onchain_bounty_id=bounty_id)
    except Exception as e:
        log.warning("publisher: createBounty failed: %s", e)
        return None


async def submit_proof_onchain(
    *, onchain_bounty_id: int, attestation_hash: bytes,
) -> Optional[OnchainTxResult]:
    if not is_configured():
        return None
    if len(attestation_hash) != 32:
        raise ValueError(f"attestation_hash must be 32 bytes, got {len(attestation_hash)}")

    factory = og_chain.get_factory()
    try:
        async with _lock:
            fn = factory.functions.submitProof(onchain_bounty_id, attestation_hash)
            tx_hash, block_number, _ = await _send_tx(fn)
        log.info(
            "publisher: submitProof -> tx=%s bountyId=%s block=%s",
            tx_hash, onchain_bounty_id, block_number,
        )
        return OnchainTxResult(tx_hash=tx_hash, block_number=block_number)
    except Exception as e:
        log.warning("publisher: submitProof failed: %s", e)
        return None


async def claim_bounty_onchain(*, onchain_bounty_id: int) -> Optional[OnchainTxResult]:
    if not is_configured():
        return None
    factory = og_chain.get_factory()
    try:
        async with _lock:
            fn = factory.functions.claimBounty(onchain_bounty_id)
            tx_hash, block_number, _ = await _send_tx(fn)
        log.info(
            "publisher: claimBounty -> tx=%s bountyId=%s block=%s",
            tx_hash, onchain_bounty_id, block_number,
        )
        return OnchainTxResult(tx_hash=tx_hash, block_number=block_number)
    except Exception as e:
        log.warning("publisher: claimBounty failed: %s", e)
        return None

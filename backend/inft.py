"""ERC-7857 iNFT lifecycle: mint the Ascertainty agent identity on 0G Chain.

Adapted from enstabler/agent/inft.py — same flow:
  1. On startup, read tokenOf(operator) on the AgentNFT contract.
  2. If 0, build the agent identity JSON (name, version, deployed contract
     addresses, supported spec families), upload to 0G Storage, and mint
     a token with the resulting Merkle root as the on-chain pointer.
  3. If a token already exists, refresh local state from chain and skip mint.

Idempotent across restarts. Mint only ever happens once per wallet/contract
pair. Local state is exposed via `get_state()` for the dashboard's agent
status panel.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, Optional

from backend import og_chain, og_storage

log = logging.getLogger("ascertainty.inft")

VERSION = "0.3.0"
DESCRIPTOR = "ascertainty-mock-lean4-v0.1"

_state: dict[str, Any] = {
    "configured": False,
    "ready": False,
    "minted": False,
    "contract_address": None,
    "token_id": None,
    "owner": None,
    "storage_root_hash": None,
    "model_descriptor": None,
    "version_tag": None,
    "minted_at": None,
    "last_updated_at": None,
    "tx_hash": None,
}
_lock = asyncio.Lock()


def get_state() -> dict[str, Any]:
    return dict(_state)


def _build_identity_blob() -> dict[str, Any]:
    """Snapshot of the agent's on-chain & off-chain identity at mint time.
    Stored in 0G Storage; the Merkle root becomes the iNFT's pointer."""
    addresses = og_chain.addresses()
    return {
        "version": 1,
        "agent": "ascertainty",
        "name": "Ascertainty Verification Oracle",
        "model_descriptor": DESCRIPTOR,
        "version_tag": VERSION,
        "minted_at": int(time.time()),
        "chain": {
            "name": "0G Galileo Testnet",
            "chain_id": addresses.get("chainId", 16602),
        },
        "contracts": addresses.get("contracts", {}),
        "operator": og_chain.get_account().address,
        "supported_specs": [
            "sort_correctness",
            "erc20_invariant",
            "heat_equation",
            "mathlib_gap_finite_prod_cardinality",
        ],
        "verifier": {
            "kind": "mock_lean4",
            "kernel_version": "ascertainty-mock-lean4-v0.1",
            "axiom_whitelist_default": ["propext", "Classical.choice", "Quot.sound"],
        },
    }


async def init() -> None:
    """Run once on app startup. Best-effort — never raises."""
    if not og_chain.is_configured():
        log.info("inft: og_chain not configured, skipping")
        return

    try:
        async with _lock:
            await _do_init()
    except Exception as e:
        log.warning("inft: init failed: %s", e)


async def _do_init() -> None:
    nft = og_chain.get_agent_nft()
    account = og_chain.get_account()
    addresses = og_chain.addresses()
    _state["configured"] = True
    _state["contract_address"] = nft.address

    # Already minted?
    existing = int(await nft.functions.tokenOf(account.address).call())
    if existing > 0:
        await _refresh_state(nft, existing, account.address)
        log.info("inft: existing token id=%s found for operator, skipping mint", existing)
        return

    # Mint flow
    log.info("inft: no token for operator — building identity blob + uploading to 0G Storage")
    identity = _build_identity_blob()
    blob = json.dumps(identity, sort_keys=True, separators=(",", ":")).encode()
    storage_result = await og_storage.upload_blob(blob, name_hint="agent-identity")

    if storage_result is None:
        # Fall back: deterministic hash from the identity blob itself
        import hashlib
        digest = hashlib.sha256(blob).digest()
        root_bytes = digest
        log.info("inft: storage upload returned None, using local sha256 as storageRootHash")
    else:
        root_bytes = storage_result.root_hash_bytes
        _state["storage_root_hash"] = storage_result.root_hash
        log.info("inft: identity uploaded, root_hash=%s", storage_result.root_hash)

    # Mint via web3.py — use the same publisher pattern (lock, live nonce, gas)
    from backend.publisher import _send_tx
    fn = nft.functions.mint(root_bytes, DESCRIPTOR, VERSION)
    tx_hash, block_number, _receipt = await _send_tx(fn)
    log.info("inft: mint tx=%s block=%s", tx_hash, block_number)

    # Re-read state from chain
    new_token_id = int(await nft.functions.tokenOf(account.address).call())
    await _refresh_state(nft, new_token_id, account.address)
    _state["minted"] = True
    _state["tx_hash"] = tx_hash


async def _refresh_state(nft, token_id: int, owner: str) -> None:
    meta = await nft.functions.metadata(token_id).call()
    storage_root_hash, model_descriptor, version_tag, minted_at, last_updated_at = meta
    _state.update({
        "ready": True,
        "token_id": token_id,
        "owner": owner,
        "storage_root_hash": "0x" + storage_root_hash.hex(),
        "model_descriptor": model_descriptor,
        "version_tag": version_tag,
        "minted_at": int(minted_at),
        "last_updated_at": int(last_updated_at),
    })

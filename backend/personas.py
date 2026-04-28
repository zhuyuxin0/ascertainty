"""Solver persona iNFTs.

Three solver personas (Aggressive Andy, Careful Carl, Balanced Bea), each
with a distinct keypair, identity blob on 0G Storage, and AgentNFT token.
The contract enforces one token per minter, so each persona mints from
its own wallet — operator funds the personas with a small OG drip first.

Idempotent across restarts: the persisted `data/personas.json` is the
source of truth; a persona is only re-minted when its address has no
on-chain token and no record in the file.

Persona metadata is what the dashboard renders as Pokemon-style cards;
the persona addresses are also the `solver_address` values that the
seed-race + watcher use to drive race events, so each persona is a
visually consistent identity across the demo.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Optional

from eth_account import Account

from backend import og_chain, og_storage

log = logging.getLogger("ascertainty.personas")

PERSONAS_FILE = Path(__file__).resolve().parent.parent / "data" / "personas.json"
DRIP_AMOUNT_WEI = 5_000_000_000_000_000  # 0.005 OG, enough for one mint tx
SEND_TIMEOUT = 120

# Locked persona definitions. The descriptor + version differ per persona
# so each iNFT has visibly distinct on-chain metadata.
PERSONA_DEFS: list[dict[str, Any]] = [
    {
        "slug": "aggressive-andy",
        "name": "Aggressive Andy",
        "emoji": "🔥",
        "color": "#ff6b35",
        "tagline": "Fast first, prove later",
        "profile": "speed",
        "axiom_breadth": 5,
        "descriptor": "ascertainty-persona-andy-v0.1",
        "version": "0.3.0-andy",
    },
    {
        "slug": "careful-carl",
        "name": "Careful Carl",
        "emoji": "🧊",
        "color": "#00d4aa",
        "tagline": "Mathlib-only, zero axiom abuse",
        "profile": "accuracy",
        "axiom_breadth": 2,
        "descriptor": "ascertainty-persona-carl-v0.1",
        "version": "0.3.0-carl",
    },
    {
        "slug": "balanced-bea",
        "name": "Balanced Bea",
        "emoji": "⚖️",
        "color": "#a855f7",
        "tagline": "Tactic-rich, audit-friendly",
        "profile": "balanced",
        "axiom_breadth": 3,
        "descriptor": "ascertainty-persona-bea-v0.1",
        "version": "0.3.0-bea",
    },
]

_lock = asyncio.Lock()
_state: dict[str, Any] = {"configured": False, "personas": []}


def get_state() -> dict[str, Any]:
    return {"configured": _state["configured"], "personas": list(_state["personas"])}


def _derive_key(operator_key_hex: str, slug: str) -> str:
    """Deterministic privkey per (operator, persona). Reproducible across
    restarts and host moves; never written into git."""
    seed = bytes.fromhex(operator_key_hex.removeprefix("0x")) + b"|persona|" + slug.encode()
    digest = hashlib.sha256(seed).digest()
    return "0x" + digest.hex()


def _load_persisted() -> dict[str, dict[str, Any]]:
    if not PERSONAS_FILE.exists():
        return {}
    try:
        return {p["slug"]: p for p in json.loads(PERSONAS_FILE.read_text())}
    except Exception as e:
        log.warning("personas: failed to read %s: %s", PERSONAS_FILE, e)
        return {}


def _persist(personas: list[dict[str, Any]]) -> None:
    PERSONAS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PERSONAS_FILE.write_text(json.dumps(personas, indent=2) + "\n")


def get_persona_addresses() -> list[str]:
    """Public: addresses of the 3 personas, in declared order. Used by
    seed-race + race HUD as solver_address values. Returns [] if not
    yet bootstrapped — caller should fall back to placeholder addresses."""
    return [p["address"] for p in _state["personas"] if p.get("address")]


def get_persona_by_address(address: str) -> Optional[dict[str, Any]]:
    target = address.lower()
    for p in _state["personas"]:
        if (p.get("address") or "").lower() == target:
            return p
    return None


def get_persona_by_slug(slug: str) -> Optional[dict[str, Any]]:
    for p in _state["personas"]:
        if p.get("slug") == slug:
            return p
    return None


def set_wearing(slug: str, badges: list[str]) -> bool:
    """Update the persona's worn-badge list and re-persist personas.json.
    Returns True if the persona exists. Caller is responsible for
    validating that each badge is a real catalog slug; the engine
    accepts any list (so the operator can experimentally pin even
    not-yet-earned badges if they want a 'future-self' card)."""
    p = get_persona_by_slug(slug)
    if p is None:
        return False
    p["wearing_badges"] = list(badges)
    _persist(_state["personas"])
    return True


async def init() -> None:
    """Idempotent — bootstraps any persona that is not yet on-chain."""
    if not og_chain.is_configured():
        log.info("personas: og_chain not configured, skipping")
        return
    try:
        async with _lock:
            await _do_init()
    except Exception as e:
        log.warning("personas: init failed: %s", e)


async def _do_init() -> None:
    operator_key = os.getenv("OG_PRIVATE_KEY")
    if not operator_key:
        log.info("personas: OG_PRIVATE_KEY missing, skipping")
        return

    persisted = _load_persisted()
    nft = og_chain.get_agent_nft()
    w3 = og_chain.get_w3()

    out: list[dict[str, Any]] = []
    for spec in PERSONA_DEFS:
        slug = spec["slug"]
        privkey = _derive_key(operator_key, slug)
        account = Account.from_key(privkey)
        addr = account.address

        existing_token = int(await nft.functions.tokenOf(addr).call())

        rec = persisted.get(slug, {})
        if existing_token > 0:
            # Already on-chain. Refresh metadata from the contract.
            meta = await nft.functions.metadata(existing_token).call()
            storage_root_hash, model_descriptor, version_tag, minted_at, _ = meta
            rec.update({
                "slug": slug,
                "name": spec["name"],
                "emoji": spec["emoji"],
                "color": spec["color"],
                "tagline": spec["tagline"],
                "profile": spec["profile"],
                "axiom_breadth": spec["axiom_breadth"],
                "address": addr,
                "private_key": privkey,
                "token_id": existing_token,
                "storage_root_hash": "0x" + storage_root_hash.hex(),
                "descriptor": model_descriptor,
                "version": version_tag,
                "minted_at": int(minted_at),
                "wearing_badges": rec.get("wearing_badges", []),
            })
            out.append(rec)
            log.info("personas: %s already minted as token #%d", slug, existing_token)
            continue

        # Need to mint. First top up gas if persona's balance is too low.
        bal = await w3.eth.get_balance(addr)
        if bal < DRIP_AMOUNT_WEI:
            tx_hash = await _send_drip(addr, DRIP_AMOUNT_WEI - bal + DRIP_AMOUNT_WEI)
            log.info("personas: %s topped up gas (tx=%s)", slug, tx_hash)

        # Build + upload identity blob
        identity = _build_identity_blob(spec, addr)
        blob = json.dumps(identity, sort_keys=True, separators=(",", ":")).encode()
        storage = await og_storage.upload_blob(blob, name_hint=f"persona-{slug}")
        if storage is not None:
            root_bytes = storage.root_hash_bytes
            root_hex = storage.root_hash
        else:
            root_bytes = hashlib.sha256(blob).digest()
            root_hex = "0x" + root_bytes.hex()
            log.info("personas: %s storage upload unavailable, using local sha256", slug)

        # Persona key calls mint
        mint_tx = await _persona_mint(account, root_bytes, spec["descriptor"], spec["version"])
        log.info("personas: %s mint tx=%s", slug, mint_tx)

        # Read back the assigned token id
        new_token = int(await nft.functions.tokenOf(addr).call())
        rec = {
            "slug": slug,
            "name": spec["name"],
            "emoji": spec["emoji"],
            "color": spec["color"],
            "tagline": spec["tagline"],
            "profile": spec["profile"],
            "axiom_breadth": spec["axiom_breadth"],
            "address": addr,
            "private_key": privkey,
            "token_id": new_token,
            "storage_root_hash": root_hex,
            "descriptor": spec["descriptor"],
            "version": spec["version"],
            "minted_at": int(time.time()),
            "wearing_badges": [],
        }
        out.append(rec)

    _state["configured"] = True
    _state["personas"] = out
    _persist(out)


def _build_identity_blob(spec: dict[str, Any], address: str) -> dict[str, Any]:
    addresses = og_chain.addresses()
    return {
        "version": 1,
        "agent": "ascertainty-persona",
        "slug": spec["slug"],
        "name": spec["name"],
        "tagline": spec["tagline"],
        "emoji": spec["emoji"],
        "color": spec["color"],
        "profile": spec["profile"],
        "axiom_breadth": spec["axiom_breadth"],
        "address": address,
        "model_descriptor": spec["descriptor"],
        "version_tag": spec["version"],
        "minted_at": int(time.time()),
        "chain": {
            "name": "0G Galileo Testnet",
            "chain_id": addresses.get("chainId", 16602),
        },
        "contracts": addresses.get("contracts", {}),
    }


async def _send_drip(to_addr: str, amount_wei: int) -> str:
    """Operator-wallet funded gas drip. Reuses publisher's _send_tx tx-build
    pattern but for a plain value-transfer (no contract call)."""
    w3 = og_chain.get_w3()
    operator = og_chain.get_account()
    chain_id = await og_chain.get_chain_id()
    nonce = await w3.eth.get_transaction_count(operator.address, "pending")
    gas_price = await w3.eth.gas_price
    tx = {
        "from": operator.address,
        "to": og_chain.AsyncWeb3.to_checksum_address(to_addr),
        "value": int(amount_wei),
        "nonce": nonce,
        "gasPrice": gas_price,
        "chainId": chain_id,
        "gas": 21000,
    }
    signed = operator.sign_transaction(tx)
    tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=SEND_TIMEOUT)
    if receipt["status"] != 1:
        raise RuntimeError(f"gas drip reverted: {tx_hash.hex()}")
    return tx_hash.hex()


async def _persona_mint(account, root_bytes: bytes, descriptor: str, version: str) -> str:
    """Persona-key-signed AgentNFT.mint."""
    w3 = og_chain.get_w3()
    nft = og_chain.get_agent_nft()
    chain_id = await og_chain.get_chain_id()
    nonce = await w3.eth.get_transaction_count(account.address, "pending")
    gas_price = await w3.eth.gas_price
    fn = nft.functions.mint(root_bytes, descriptor, version)
    tx = await fn.build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gasPrice": gas_price,
        "chainId": chain_id,
    })
    signed = account.sign_transaction(tx)
    tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=SEND_TIMEOUT)
    if receipt["status"] != 1:
        raise RuntimeError(f"persona mint reverted: {tx_hash.hex()}")
    return tx_hash.hex()

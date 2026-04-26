"""CCTP v1 cross-chain USDC transfer monitor (ported from Enstabler).

Subscribes to Circle TokenMessenger v1 `DepositForBurn` events on Ethereum
mainnet via Alchemy WS, decodes each log, and persists unique
(source_domain, nonce) records to SQLite. Ascertainty uses this to track
cross-chain USDC flows in/out of bounty escrow.

CCTP v1 DepositForBurn event:
    event DepositForBurn(
        uint64  indexed nonce,
        address indexed burnToken,
        uint256         amount,
        address indexed depositor,
        bytes32         mintRecipient,
        uint32          destinationDomain,
        bytes32         destinationTokenMessenger,
        bytes32         destinationCaller
    );
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, Optional

import websockets

from backend import db

log = logging.getLogger("ascertainty.cctp")

CCTP_V1_TOKEN_MESSENGER = "0xBd3fa81B58Ba92a82136038B25aDec7066af3155"

# keccak256("DepositForBurn(uint64,address,uint256,address,bytes32,uint32,bytes32,bytes32)")
DEPOSIT_FOR_BURN_TOPIC = "0x2fa9ca894982930190727e75500a97d8dc500233a5065e0f3126c48fbe0343c0"

DOMAIN_NAMES: dict[int, str] = {
    0: "ethereum",
    1: "avalanche",
    2: "optimism",
    3: "arbitrum",
    4: "noble",
    5: "solana",
    6: "base",
    7: "polygon",
    10: "unichain",
    11: "linea",
}

USDC_DECIMALS = 6
SOURCE_CHAIN_NAME = "ethereum"
SOURCE_DOMAIN = 0


def _alchemy_ws_url() -> Optional[str]:
    url = os.getenv("ALCHEMY_WS_URL")
    if url:
        return url
    key = os.getenv("ALCHEMY_API_KEY")
    if not key:
        return None
    return f"wss://eth-mainnet.g.alchemy.com/v2/{key}"


def decode_deposit_for_burn(topics: list[str], data: str) -> dict[str, Any]:
    if len(topics) < 4:
        raise ValueError("expected 4 topics (sig, nonce, burnToken, depositor)")
    nonce = int(topics[1], 16)
    burn_token = "0x" + topics[2][-40:].lower()
    depositor = "0x" + topics[3][-40:].lower()

    body = data[2:] if data.startswith("0x") else data
    if len(body) < 5 * 64:
        raise ValueError(f"data too short: {len(body)} hex chars, need {5*64}")
    words = [body[i * 64 : (i + 1) * 64] for i in range(5)]

    amount = int(words[0], 16)
    mint_recipient = "0x" + words[1].lower()
    destination_domain = int(words[2], 16)
    destination_token_messenger = "0x" + words[3].lower()
    destination_caller = "0x" + words[4].lower()

    return {
        "nonce": nonce,
        "burn_token": burn_token,
        "amount_raw": amount,
        "depositor": depositor,
        "mint_recipient": mint_recipient,
        "destination_domain": destination_domain,
        "destination_token_messenger": destination_token_messenger,
        "destination_caller": destination_caller,
    }


def domain_name(domain_id: int) -> str:
    return DOMAIN_NAMES.get(domain_id, f"domain_{domain_id}")


# ---------- Alchemy WebSocket task ----------

async def cctp_task() -> None:
    ws_url = _alchemy_ws_url()
    if not ws_url:
        log.warning("cctp: ALCHEMY_API_KEY / ALCHEMY_WS_URL not set, skipping")
        return

    backoff = 1.0
    while True:
        try:
            log.info("cctp: connecting")
            async with websockets.connect(ws_url, ping_interval=20, ping_timeout=20) as ws:
                sub_id = await _subscribe(ws)
                log.info("cctp: subscribed id=%s", sub_id)
                backoff = 1.0
                async for raw in ws:
                    await _handle_message(raw)
        except asyncio.CancelledError:
            log.info("cctp: cancelled")
            raise
        except Exception as e:
            log.warning("cctp: connection error: %s (reconnect in %.1fs)", e, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30.0)


async def _subscribe(ws) -> str:
    req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_subscribe",
        "params": [
            "logs",
            {
                "address": CCTP_V1_TOKEN_MESSENGER,
                "topics": [DEPOSIT_FOR_BURN_TOPIC],
            },
        ],
    }
    await ws.send(json.dumps(req))
    while True:
        raw = await ws.recv()
        msg = json.loads(raw)
        if msg.get("id") == 1:
            if "result" in msg:
                return msg["result"]
            raise RuntimeError(f"cctp subscribe failed: {msg}")


async def _handle_message(raw: str) -> None:
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        return
    result = (msg.get("params") or {}).get("result")
    if not result:
        return

    topics = result.get("topics") or []
    data = result.get("data") or "0x"
    if not topics or topics[0].lower() != DEPOSIT_FOR_BURN_TOPIC:
        return

    try:
        decoded = decode_deposit_for_burn(topics, data)
    except Exception as e:
        log.warning("cctp: decode error: %s", e)
        return

    tx_hash = result.get("transactionHash") or ""
    try:
        block_number = int(result.get("blockNumber", "0x0"), 16)
        log_index = int(result.get("logIndex", "0x0"), 16)
    except (TypeError, ValueError):
        return

    amount_usd = decoded["amount_raw"] / (10 ** USDC_DECIMALS)
    dest_chain = domain_name(decoded["destination_domain"])

    inserted = await db.insert_cctp_message(
        ts=int(time.time()),
        source_chain=SOURCE_CHAIN_NAME,
        source_domain=SOURCE_DOMAIN,
        destination_chain=dest_chain,
        destination_domain=decoded["destination_domain"],
        nonce=decoded["nonce"],
        burn_token=decoded["burn_token"],
        amount_raw=str(decoded["amount_raw"]),
        amount_usd=amount_usd,
        depositor=decoded["depositor"],
        mint_recipient=decoded["mint_recipient"],
        tx_hash=tx_hash,
        block_number=block_number,
        log_index=log_index,
    )
    if not inserted:
        return

    log.info(
        "cctp: %s → %s $%s usdc tx=%s",
        SOURCE_CHAIN_NAME, dest_chain, f"{amount_usd:,.0f}", tx_hash[:18],
    )

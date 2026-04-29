"""Polymarket CLOB public-API ingestion.

Pulls a snapshot of active prediction markets from Polymarket's public
endpoint (no auth needed for read), normalizes to a fixed schema, and
caches into SQLite. Refresh runs hourly via APScheduler in the main app.

Endpoint: https://clob.polymarket.com/markets
Returns paginated array; we walk the cursor until we have ~200 active
markets, sized down per market to the fields the atlas UI needs.

Each row: (market_id, slug, question, probability, volume_usd, category,
end_date_iso, last_updated). Category is derived heuristically from the
question text — Polymarket's own category tags aren't always present in
the public response.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from typing import Any, Optional

import httpx

from backend import db

log = logging.getLogger("ascertainty.atlas.polymarket")

POLYMARKET_URL = "https://clob.polymarket.com/markets"
TARGET_COUNT = 150  # active markets we want to keep cached
REQUEST_TIMEOUT = 30.0


async def fetch_markets() -> list[dict[str, Any]]:
    """Walk the Polymarket cursor until we've collected ~200 active markets
    or hit the end of the feed. Returns a list of raw market dicts."""
    out: list[dict[str, Any]] = []
    cursor: Optional[str] = None
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        while len(out) < TARGET_COUNT * 2:  # walk a bit more than target
            params: dict[str, Any] = {}
            if cursor:
                params["next_cursor"] = cursor
            try:
                resp = await client.get(POLYMARKET_URL, params=params)
                resp.raise_for_status()
            except httpx.HTTPError as e:
                log.warning("polymarket: fetch failed: %s", e)
                break
            payload = resp.json()
            data = payload.get("data") or payload.get("markets") or []
            if not data:
                break
            out.extend(data)
            cursor = payload.get("next_cursor")
            if not cursor or cursor == "LTE=":
                break
            await asyncio.sleep(0.2)  # be polite
    log.info("polymarket: fetched %d raw markets", len(out))
    return out


def _category_from_question(q: str) -> str:
    """Heuristic categorisation. Polymarket exposes some category tags
    inconsistently; we re-derive from question text for stability."""
    q_l = q.lower()
    rules = [
        ("ai", ["gpt", "claude", "gemini", "llama", "openai", "anthropic", "deepseek", "ai model", "agi", "llm"]),
        ("crypto", ["bitcoin", "btc", "ethereum", "eth", "solana", "sol", "crypto", "stablecoin"]),
        ("politics", ["trump", "biden", "election", "president", "congress", "senate", "vote"]),
        ("sports", ["nba", "nfl", "premier league", "wins", "championship", "tournament", "world cup", "ufc"]),
        ("science", ["fusion", "quantum", "vaccine", "discovery", "nobel", "study"]),
        ("entertainment", ["box office", "movie", "oscar", "grammy", "album", "season"]),
    ]
    for cat, kws in rules:
        if any(k in q_l for k in kws):
            return cat
    return "other"


def _normalize(raw: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Reduce a Polymarket market record to the schema the atlas needs.
    Returns None if the market is missing required fields or is closed."""
    if not raw.get("active") and raw.get("closed"):
        return None
    market_id = raw.get("condition_id") or raw.get("market_slug") or raw.get("id")
    question = raw.get("question") or ""
    if not market_id or not question:
        return None
    # Probability: take the first outcome's price (binary markets)
    tokens = raw.get("tokens") or []
    prob = None
    if tokens:
        try:
            prob = float(tokens[0].get("price", 0))
        except (TypeError, ValueError):
            prob = None
    if prob is None:
        return None
    volume = 0.0
    try:
        volume = float(raw.get("volume_num") or raw.get("volume") or 0)
    except (TypeError, ValueError):
        pass
    return {
        "market_id": str(market_id),
        "slug": raw.get("market_slug") or "",
        "question": question[:400],
        "probability": prob,
        "volume_usd": volume,
        "category": _category_from_question(question),
        "end_date_iso": raw.get("end_date_iso") or "",
        "last_updated": int(time.time()),
    }


async def ingest_once() -> int:
    """One-shot ingestion. Returns number of markets persisted."""
    raws = await fetch_markets()
    rows: list[dict[str, Any]] = []
    for raw in raws:
        n = _normalize(raw)
        if n is not None:
            rows.append(n)
        if len(rows) >= TARGET_COUNT:
            break
    if not rows:
        log.warning("polymarket: zero markets after normalize — leaving cache untouched")
        return 0
    await db.atlas_replace_markets(rows)
    log.info("polymarket: persisted %d markets", len(rows))
    return len(rows)

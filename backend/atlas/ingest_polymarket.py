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


GAMMA_MARKETS_URL = "https://gamma-api.polymarket.com/markets"


async def fetch_markets() -> list[dict[str, Any]]:
    """Fetch active markets via Polymarket's Gamma API, which (unlike the
    raw CLOB endpoint) returns only current/non-resolved markets and
    supports volume-based sorting. Returns up to ~600 raw markets;
    downstream code filters to TARGET_COUNT after normalization.

    The Gamma response shape differs slightly from CLOB; both are handled
    in `_normalize`."""
    out: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        # Page through in 100-market chunks, ordered by volume desc
        for offset in range(0, 600, 100):
            params = {
                "active": "true",
                "closed": "false",
                "archived": "false",
                "limit": 100,
                "offset": offset,
                "order": "volumeNum",
                "ascending": "false",
            }
            try:
                resp = await client.get(GAMMA_MARKETS_URL, params=params)
                resp.raise_for_status()
            except httpx.HTTPError as e:
                log.warning("polymarket(gamma): fetch failed at offset=%d: %s", offset, e)
                break
            data = resp.json()
            if not isinstance(data, list) or not data:
                break
            out.extend(data)
            if len(data) < 100:
                break
            await asyncio.sleep(0.15)
    log.info("polymarket(gamma): fetched %d raw markets", len(out))
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
    """Reduce a Polymarket market record (Gamma or CLOB shape) to the
    schema the atlas needs. Skips markets that are resolved, archived,
    or have probability pinned at 0/1 (almost certainly resolved-but-
    mislabelled)."""
    if raw.get("closed") or raw.get("archived"):
        return None
    market_id = (
        raw.get("conditionId")
        or raw.get("condition_id")
        or raw.get("slug")
        or raw.get("id")
    )
    question = raw.get("question") or raw.get("title") or ""
    if not market_id or not question:
        return None
    # Probability: try outcomePrices (Gamma), tokens[0].price (CLOB)
    prob: Optional[float] = None
    op = raw.get("outcomePrices")
    if isinstance(op, str):
        # Gamma returns a JSON-encoded array string sometimes
        try:
            op = json.loads(op)
        except (json.JSONDecodeError, TypeError):
            op = None
    if isinstance(op, list) and op:
        try:
            prob = float(op[0])
        except (TypeError, ValueError):
            pass
    if prob is None:
        tokens = raw.get("tokens") or []
        if tokens:
            try:
                prob = float(tokens[0].get("price", 0))
            except (TypeError, ValueError):
                pass
    if prob is None:
        return None
    # Skip pinned-resolved-or-uninteresting markets
    if prob <= 0.005 or prob >= 0.995:
        return None
    volume = 0.0
    for k in ("volumeNum", "volume_num", "volume"):
        try:
            v = raw.get(k)
            if v is not None:
                volume = float(v)
                break
        except (TypeError, ValueError):
            pass
    if volume < 1000:  # filter dust markets
        return None
    return {
        "market_id": str(market_id),
        "slug": raw.get("slug") or raw.get("market_slug") or "",
        "question": question[:400],
        "probability": prob,
        "volume_usd": volume,
        "category": _category_from_question(question),
        "end_date_iso": raw.get("endDate") or raw.get("end_date_iso") or "",
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

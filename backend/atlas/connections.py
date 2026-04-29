"""Cross-domain edge builder.

Walks every Polymarket market question, regex-matches model-name aliases,
emits (market_id, model_id) tuples. The frontend draws these as ArcLayer
edges from the Markets region to the AI Models region — the "this is one
connected information map" demo beat.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from backend import db

log = logging.getLogger("ascertainty.atlas.connections")

# (regex, model_id) — order matters when multiple match
MODEL_ALIASES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bgpt[\s-]?5\.5\b", re.I), "gpt-5-5"),
    (re.compile(r"\bgpt[\s-]?5\.4[\s-]?pro\b", re.I), "gpt-5-4-pro"),
    (re.compile(r"\bgpt[\s-]?5(?!\.)\b", re.I), "gpt-5-mini"),  # generic gpt-5 → mini
    (re.compile(r"\bgpt[\s-]?4\.1\b", re.I), "gpt-4-1"),
    (re.compile(r"\bgpt[\s-]?4(?!\.)\b", re.I), "gpt-4-1"),
    (re.compile(r"\bo3[\s-]?pro\b", re.I), "o3-pro"),
    (re.compile(r"\bo4[\s-]?mini\b", re.I), "o4-mini"),
    (re.compile(r"\bopenai\b", re.I), "gpt-5-5"),
    (re.compile(r"\bclaude\s*4\.7\b", re.I), "claude-4-7-sonnet"),
    (re.compile(r"\bclaude\s*4\b", re.I), "claude-4-7-sonnet"),
    (re.compile(r"\bclaude\b", re.I), "claude-4-7-sonnet"),
    (re.compile(r"\banthropic\b", re.I), "claude-4-7-opus"),
    (re.compile(r"\bgemini\s*3\b", re.I), "gemini-3-1-ultra"),
    (re.compile(r"\bgemini\b", re.I), "gemini-3-pro"),
    (re.compile(r"\bdeepseek\s*v?4\b", re.I), "deepseek-v4"),
    (re.compile(r"\bdeepseek\s*r?1\b", re.I), "deepseek-r1"),
    (re.compile(r"\bdeepseek\b", re.I), "deepseek-v4"),
    (re.compile(r"\bllama\s*4\b", re.I), "llama-4-405b"),
    (re.compile(r"\bllama\b", re.I), "llama-4-70b"),
    (re.compile(r"\bgrok\s*4\b", re.I), "grok-4"),
    (re.compile(r"\bgrok\b", re.I), "grok-3"),
    (re.compile(r"\bqwen\b", re.I), "qwen-3-72b"),
    (re.compile(r"\bmistral\b", re.I), "mistral-large-3"),
]

# Generic AI-mention catch-all — produces a small ambient connection density
# even when no specific model is named, to make the cross-domain edge layer
# visible at cosmos zoom
AI_MENTION = re.compile(
    r"\b(ai\s*model|chatbot|llm|large language model|frontier model|agi)\b",
    re.I,
)
AI_DEFAULT_TARGET = "gpt-5-5"  # default tether for generic AI mentions


async def rebuild_connections() -> int:
    """Walk every market question, emit (market_id, model_id) edges. Returns
    edge count."""
    markets = await db.atlas_markets()
    pairs: list[tuple[str, str]] = []
    for m in markets:
        q = m["question"] or ""
        matched = False
        for pat, model_id in MODEL_ALIASES:
            if pat.search(q):
                pairs.append((m["market_id"], model_id))
                matched = True
                break
        if not matched and AI_MENTION.search(q):
            pairs.append((m["market_id"], AI_DEFAULT_TARGET))
    await db.atlas_replace_connections(pairs)
    log.info("connections: %d edges", len(pairs))
    return len(pairs)

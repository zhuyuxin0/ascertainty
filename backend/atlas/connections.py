"""Cross-domain edge builder.

Walks every Polymarket market question, looks for evidence of a connection
to one of the 50 ingested AI models, and emits an edge with:

  - confidence: 1.0 for a direct named-model match (`gpt-5.5`, `claude 4.7`),
                ~0.55 for an alias / family match (`openai`, `anthropic`),
                ~0.3 for a generic AI mention with no specific model.
  - reason: the matched substring as it appeared in the question — surfaced
            as a hover tooltip on each arc so the user can see *why* a
            given market is tethered to a given model.

The result is a real epistemic graph: arcs only exist where a market's
question literally references the model on the other end. The frontend
sorts by confidence and renders the top-N arcs with opacity scaled by
confidence.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Optional

from backend import db

log = logging.getLogger("ascertainty.atlas.connections")


@dataclass(frozen=True)
class Matcher:
    pattern: re.Pattern[str]
    model_id: str
    confidence: float


# Order matters — earlier patterns win for the same question. Specific
# model names get 1.0, family names get 0.55.
MATCHERS: list[Matcher] = [
    # OpenAI specifics
    Matcher(re.compile(r"\bgpt[\s-]?5\.5\b", re.I), "gpt-5-5", 1.0),
    Matcher(re.compile(r"\bgpt[\s-]?5\.4[\s-]?pro\b", re.I), "gpt-5-4-pro", 1.0),
    Matcher(re.compile(r"\bgpt[\s-]?5\b", re.I), "gpt-5-mini", 0.85),
    Matcher(re.compile(r"\bgpt[\s-]?4\.1\b", re.I), "gpt-4-1", 1.0),
    Matcher(re.compile(r"\bgpt[\s-]?4\b", re.I), "gpt-4-1", 0.7),
    Matcher(re.compile(r"\bo3[\s-]?pro\b", re.I), "o3-pro", 1.0),
    Matcher(re.compile(r"\bo4[\s-]?mini\b", re.I), "o4-mini", 1.0),
    # Anthropic specifics
    Matcher(re.compile(r"\bclaude\s*4\.7\b", re.I), "claude-4-7-sonnet", 1.0),
    Matcher(re.compile(r"\bclaude\s*4\b", re.I), "claude-4-7-sonnet", 0.85),
    Matcher(re.compile(r"\bclaude\b", re.I), "claude-4-7-sonnet", 0.7),
    # Google
    Matcher(re.compile(r"\bgemini\s*3\b", re.I), "gemini-3-1-ultra", 0.9),
    Matcher(re.compile(r"\bgemini\b", re.I), "gemini-3-pro", 0.7),
    # DeepSeek
    Matcher(re.compile(r"\bdeepseek\s*v?4\b", re.I), "deepseek-v4", 1.0),
    Matcher(re.compile(r"\bdeepseek\s*r1\b", re.I), "deepseek-r1", 1.0),
    Matcher(re.compile(r"\bdeepseek\b", re.I), "deepseek-v4", 0.7),
    # Meta / open
    Matcher(re.compile(r"\bllama\s*4\b", re.I), "llama-4-405b", 0.95),
    Matcher(re.compile(r"\bllama\b", re.I), "llama-4-70b", 0.7),
    # xAI
    Matcher(re.compile(r"\bgrok\s*4\b", re.I), "grok-4", 1.0),
    Matcher(re.compile(r"\bgrok\b", re.I), "grok-3", 0.7),
    # Other
    Matcher(re.compile(r"\bqwen\b", re.I), "qwen-3-72b", 0.7),
    Matcher(re.compile(r"\bmistral\b", re.I), "mistral-large-3", 0.7),
    # Lab/family aliases — weaker (gives a cyan ambient band of arcs without
    # being as bold as a direct named-model match)
    Matcher(re.compile(r"\bopenai\b", re.I), "gpt-5-5", 0.55),
    Matcher(re.compile(r"\banthropic\b", re.I), "claude-4-7-sonnet", 0.55),
]

# Generic AI mention catch-all — produces low-confidence ambient connections
# only where no specific model was named.
AI_MENTION = re.compile(
    r"\b(ai\s*model|chatbot|llm|large language model|frontier model|agi)\b",
    re.I,
)
AI_DEFAULT_TARGET = "gpt-5-5"


def _first_match(question: str) -> Optional[tuple[Matcher, str]]:
    """Return the first matching (Matcher, matched_substring) for `question`."""
    for m in MATCHERS:
        hit = m.pattern.search(question)
        if hit:
            return m, hit.group(0)
    return None


async def rebuild_connections() -> int:
    """Walk every market, emit (market_id, model_id, confidence, reason)
    rows. Returns the edge count."""
    markets = await db.atlas_markets()
    rows: list[tuple[str, str, float, str]] = []
    for m in markets:
        q = m["question"] or ""
        matched = _first_match(q)
        if matched is not None:
            mat, snippet = matched
            rows.append(
                (
                    m["market_id"],
                    mat.model_id,
                    mat.confidence,
                    f'matched "{snippet}"',
                )
            )
            continue
        ai_hit = AI_MENTION.search(q)
        if ai_hit:
            rows.append(
                (
                    m["market_id"],
                    AI_DEFAULT_TARGET,
                    0.3,
                    f'generic AI mention ("{ai_hit.group(0)}")',
                )
            )
    await db.atlas_replace_connections(rows)
    log.info("connections: %d edges", len(rows))
    return len(rows)

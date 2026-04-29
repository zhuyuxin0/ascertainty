"""Deterministic 2D layout for atlas models + markets.

For the curated 34-model snapshot, UMAP would be overkill: heavy dep
(numba + scikit-learn + scipy), and a learned embedding doesn't read
well at small N. Instead we hand-rule the layout to be visually
deliberate:

- Each provider gets a sector of the AI Models region (angle by provider
  rank in the catalog).
- Within a sector, models are placed radially: better aggregate score →
  closer to the region center.
- Families within a provider get sub-clustered by a small angle offset.

Layout coordinates are in *region-local* space (centered on the AI
Models region's position). The frontend adds the region center to get
absolute world coords.

Markets get a category-based sector layout under the same logic, but
within the Prediction Markets region.
"""
from __future__ import annotations

import logging
import math
import time
from typing import Any

from backend import db
from backend.atlas.models_snapshot import PROVIDER_COLORS

log = logging.getLogger("ascertainty.atlas.layout")

# Region positions match dashboard/lib/atlas/regions.ts
AI_MODELS_CENTER = (380.0, 280.0)
AI_MODELS_RADIUS = 180.0
PREDICTION_MARKETS_CENTER = (380.0, -280.0)
PREDICTION_MARKETS_RADIUS = 160.0

# Provider angular order (radians, starting at 12 o'clock going clockwise)
PROVIDER_ORDER = [
    "OpenAI",
    "Anthropic",
    "Google",
    "Meta",
    "DeepSeek",
    "Mistral",
    "xAI",
    "Alibaba",
    "Cohere",
    "Open-source",
]
PROVIDER_ANGLE_GAP = (2 * math.pi) / len(PROVIDER_ORDER)

# Categories for markets
CATEGORY_ORDER = ["politics", "ai", "crypto", "sports", "entertainment", "science", "other"]
CATEGORY_ANGLE_GAP = (2 * math.pi) / len(CATEGORY_ORDER)


def _provider_sector_angle(provider: str) -> float:
    try:
        idx = PROVIDER_ORDER.index(provider)
    except ValueError:
        idx = len(PROVIDER_ORDER) - 1
    # Start at top (-π/2), go clockwise
    return -math.pi / 2 + idx * PROVIDER_ANGLE_GAP


def _category_sector_angle(category: str) -> float:
    try:
        idx = CATEGORY_ORDER.index(category)
    except ValueError:
        idx = len(CATEGORY_ORDER) - 1
    return -math.pi / 2 + idx * CATEGORY_ANGLE_GAP


def layout_models(models: list[dict[str, Any]]) -> dict[str, tuple[float, float]]:
    """Returns {model_id: (x, y)} in WORLD coordinates (relative to canvas
    origin, not region origin)."""
    # Group by provider
    by_provider: dict[str, list[dict[str, Any]]] = {}
    for m in models:
        by_provider.setdefault(m["provider"], []).append(m)

    out: dict[str, tuple[float, float]] = {}
    cx, cy = AI_MODELS_CENTER
    R = AI_MODELS_RADIUS

    for provider, group in by_provider.items():
        sector_center = _provider_sector_angle(provider)
        # Sort by aggregate desc — best model closest to center
        group_sorted = sorted(group, key=lambda m: -m.get("aggregate", 0))
        n = len(group_sorted)
        # Spread within ±18° around the sector center
        sector_width = (PROVIDER_ANGLE_GAP * 0.7)
        for i, m in enumerate(group_sorted):
            agg = m.get("aggregate") or 50.0
            # Better aggregate → smaller radius from center (closer to middle)
            # Map agg [50..95] → r [0.4R..0.85R] inverted
            agg_n = max(0.0, min(1.0, (agg - 50.0) / 45.0))
            r = R * (0.85 - 0.45 * agg_n)
            # Spread family/model siblings within sector
            if n > 1:
                offset = ((i / (n - 1)) - 0.5) * sector_width
            else:
                offset = 0.0
            angle = sector_center + offset
            x = cx + r * math.cos(angle)
            y = cy + r * math.sin(angle)
            out[m["model_id"]] = (x, y)
    return out


def layout_markets(markets: list[dict[str, Any]]) -> dict[str, tuple[float, float]]:
    """Same scheme for markets, by category, within the Prediction Markets region."""
    by_cat: dict[str, list[dict[str, Any]]] = {}
    for m in markets:
        by_cat.setdefault(m["category"], []).append(m)

    out: dict[str, tuple[float, float]] = {}
    cx, cy = PREDICTION_MARKETS_CENTER
    R = PREDICTION_MARKETS_RADIUS

    for cat, group in by_cat.items():
        sector_center = _category_sector_angle(cat)
        # Sort by volume desc — high-volume markets sit toward sector edge
        # but with a wider spread so we can see them
        group_sorted = sorted(group, key=lambda m: -m.get("volume_usd", 0))
        n = len(group_sorted)
        sector_width = (CATEGORY_ANGLE_GAP * 0.8)
        for i, m in enumerate(group_sorted):
            # Volume-based ring: top 25% of volume sits in inner ring,
            # rest spreads outward
            vol = m.get("volume_usd") or 0
            # Within-category percentile
            rank = i / max(1, n - 1)
            r = R * (0.35 + 0.55 * rank)
            # Slight radial jitter from market_id hash for visual richness
            jitter = (hash(m["market_id"]) % 100 - 50) / 100.0 * 8.0
            r += jitter
            if n > 1:
                offset = ((i / (n - 1)) - 0.5) * sector_width
            else:
                offset = 0.0
            angle = sector_center + offset
            x = cx + r * math.cos(angle)
            y = cy + r * math.sin(angle)
            out[m["market_id"]] = (x, y)
    return out


async def recompute_all() -> dict[str, int]:
    """Recompute and persist layouts for all models + markets."""
    models = await db.atlas_models()
    markets = await db.atlas_markets()
    model_layout = layout_models(models)
    market_layout = layout_markets(markets)
    if model_layout:
        await db.atlas_set_model_layout(model_layout)
    if market_layout:
        await db.atlas_set_market_layout(market_layout)
    log.info(
        "layout: %d models, %d markets positioned",
        len(model_layout), len(market_layout),
    )
    return {"models": len(model_layout), "markets": len(market_layout)}

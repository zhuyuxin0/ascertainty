"""Persist the curated model snapshot into the SQLite atlas tables.

Idempotent: clears + re-inserts on each call. Cheap because the dataset
is small (~50 rows). Future enhancement: layer freshness on top from a
real provider API, but the snapshot remains the demo's source of truth.
"""
from __future__ import annotations

import logging

from backend import db
from backend.atlas.models_snapshot import MODELS, aggregate_score

log = logging.getLogger("ascertainty.atlas.models")


async def ingest_once() -> int:
    rows = []
    for m in MODELS:
        rows.append({
            "model_id": m["id"],
            "name": m["name"],
            "provider": m["provider"],
            "family": m["family"],
            "mmlu": m.get("mmlu"),
            "gpqa": m.get("gpqa"),
            "humaneval": m.get("humaneval"),
            "math": m.get("math"),
            "arc": m.get("arc"),
            "aggregate": aggregate_score(m),
            "last_updated_unix": m["last_updated_unix"],
            "price_input_mtok": m.get("price_input_mtok"),
            "price_output_mtok": m.get("price_output_mtok"),
            "source_url": m.get("source_url") or "",
        })
    await db.atlas_replace_models(rows)
    log.info("models: persisted %d rows", len(rows))
    return len(rows)

"""Heuristic stablecoin-flow classifier ported from Enstabler.

Used by Ascertainty's self-monitoring layer to label its own USDC escrow
transactions (payment / arbitrage / cex_flow / bot / suspicious / mint_burn)
and surface them on the dashboard. Pure logic, no external deps.
"""
from __future__ import annotations

from typing import Any


CLASSIFICATIONS = ("payment", "arbitrage", "cex_flow", "bot", "suspicious", "mint_burn")

_RISK_BY_CLASS = {
    "payment":    0,
    "cex_flow":   1,
    "arbitrage":  1,
    "bot":        1,
    "mint_burn":  1,
    "suspicious": 2,
}


def classify_flow(features: dict[str, Any]) -> str:
    if features.get("is_mint_burn"):
        return "mint_burn"
    if features.get("entity_class_receiver") == "cex":
        return "cex_flow"
    if features.get("stablecoin_spread", 0.0) > 0.001:  # >10 bps
        return "arbitrage"
    if features.get("tx_frequency_sender", 0) > 10:
        return "bot"
    if (
        features.get("tx_value_usd", 0.0) > 500_000
        and features.get("receiver_age_days", float("inf")) < 7
    ):
        return "suspicious"
    return "payment"


def risk_level(classification: str, features: dict[str, Any]) -> int:
    base = _RISK_BY_CLASS.get(classification, 0)
    if classification == "suspicious" and features.get("tx_value_usd", 0.0) > 1_000_000:
        return 3  # escalate to critical
    return base

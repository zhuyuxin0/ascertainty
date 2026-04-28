"""GitHub-style earnable badges for solver personas.

Badges are not pre-declared — they're derived from real on-chain + DB
activity. Each badge has a deterministic earn-criterion; the engine
walks every persona's submissions/wins and emits the set they qualify
for. The operator can curate which a persona "wears" on its card via
`personas.set_wearing(slug, [badge_slug])` (exposed as a POST endpoint
in main.py).

Design notes:
  - Rules are pure functions of (submissions, settled_bounties, on-chain
    reputation). No external services, no time-zone math, no LLM.
  - Tags come from `bounties.spec_yaml` parsed lazily once per call; we
    don't index tags in a separate column to keep the migration count
    low.
  - Each badge carries `name`, `emoji`, `description` (the criterion in
    plain English), and an `earned_at` timestamp from the qualifying
    submission/event. Renders on the card as a tooltip.
"""
from __future__ import annotations

import yaml
from dataclasses import dataclass
from typing import Any, Callable

import aiosqlite

from backend import db


@dataclass(frozen=True)
class BadgeRule:
    slug: str
    name: str
    emoji: str
    description: str           # plain-English criterion shown on hover
    rarity: str                # 'common' | 'uncommon' | 'rare'
    eval_fn: Callable[[dict[str, Any]], int | None]
    """eval_fn(persona_state) -> earned_at unix-ts or None.
    persona_state has: submissions (list of submission rows joined with
    bounty.spec_yaml), settled_count, reputation."""


# ---------- rule helpers ----------

def _has_tag_win(state: dict[str, Any], tag: str) -> int | None:
    """Earliest submitted_at among accepted submissions on bounties whose
    spec carries `tag`. None if no qualifying submission."""
    earliest: int | None = None
    for s in state["submissions"]:
        if not s["accepted"]:
            continue
        tags = _parse_tags(s.get("spec_yaml") or "")
        if tag in tags:
            ts = s["submitted_at"]
            if earliest is None or ts < earliest:
                earliest = ts
    return earliest


def _parse_tags(spec_yaml: str) -> set[str]:
    if not spec_yaml:
        return set()
    try:
        raw = yaml.safe_load(spec_yaml) or {}
        tags = raw.get("tags") or []
        return {t for t in tags if isinstance(t, str)}
    except Exception:
        return set()


def _first_accepted(state: dict[str, Any]) -> int | None:
    accepted = [s for s in state["submissions"] if s["accepted"]]
    return min((s["submitted_at"] for s in accepted), default=None)


def _first_relayed(state: dict[str, Any]) -> int | None:
    """First accepted submission whose on-chain submission used submitProofFor.
    We can't tell by introspecting tx receipts here, but we can use the
    proxy that accepted submissions where the solver_address differs from
    the operator must have used submitProofFor."""
    operator = state["operator_address"].lower()
    for s in sorted(state["submissions"], key=lambda r: r["submitted_at"]):
        if not s["accepted"]:
            continue
        if (s["solver_address"] or "").lower() != operator:
            return s["submitted_at"]
    return None


def _claimer_at(state: dict[str, Any]) -> int | None:
    """Earliest 'settled' bounty where this persona was the recorded solver."""
    return state.get("first_settled_at")


def _kernel_speedrun(state: dict[str, Any]) -> int | None:
    """Any accepted submission with kernel duration < 0.05s."""
    for s in state["submissions"]:
        if not s["accepted"]:
            continue
        # duration is embedded in kernel_output; we don't store it as a
        # column but the field exists in the attestation. Skip if not
        # available — gracefully no-badge.
        dur = s.get("kernel_duration_seconds")
        if dur is not None and dur < 0.05:
            return s["submitted_at"]
    return None


def _streak_3(state: dict[str, Any]) -> int | None:
    """3 consecutive accepted submissions (no rejection in between)."""
    streak = 0
    earned = None
    for s in sorted(state["submissions"], key=lambda r: r["submitted_at"]):
        if s["accepted"]:
            streak += 1
            if streak >= 3 and earned is None:
                earned = s["submitted_at"]
        else:
            streak = 0
    return earned


# ---------- the catalog ----------

RULES: list[BadgeRule] = [
    # Domain badges — emerge from real wins, not pre-declared
    BadgeRule(
        slug="pde-specialist",
        name="PDE Specialist",
        emoji="🌊",
        description="Won at least one bounty tagged `pde`.",
        rarity="rare",
        eval_fn=lambda s: _has_tag_win(s, "pde"),
    ),
    BadgeRule(
        slug="erc20-invariant-solver",
        name="ERC-20 Invariant Solver",
        emoji="🪙",
        description="Won at least one bounty tagged `erc20`.",
        rarity="uncommon",
        eval_fn=lambda s: _has_tag_win(s, "erc20"),
    ),
    BadgeRule(
        slug="mathlib-closer",
        name="Mathlib Gap Closer",
        emoji="📐",
        description="Won at least one bounty tagged `mathlib`.",
        rarity="uncommon",
        eval_fn=lambda s: _has_tag_win(s, "mathlib"),
    ),
    BadgeRule(
        slug="algorithms-prover",
        name="Algorithms Prover",
        emoji="📊",
        description="Won at least one bounty tagged `algorithms`.",
        rarity="common",
        eval_fn=lambda s: _has_tag_win(s, "algorithms"),
    ),
    # Milestones
    BadgeRule(
        slug="first-bounty",
        name="First Bounty",
        emoji="🥇",
        description="Submitted an accepted proof for the first time.",
        rarity="common",
        eval_fn=_first_accepted,
    ),
    BadgeRule(
        slug="relayer-pioneer",
        name="Gasless Pioneer",
        emoji="⛽",
        description="First accepted submission relayed via BountyFactory.submitProofFor — solver paid no gas.",
        rarity="uncommon",
        eval_fn=_first_relayed,
    ),
    BadgeRule(
        slug="claimer",
        name="Claimer",
        emoji="💰",
        description="At least one bounty settled to this solver after the challenge window.",
        rarity="uncommon",
        eval_fn=_claimer_at,
    ),
    # Style
    BadgeRule(
        slug="streak-3",
        name="Streak: Three",
        emoji="🔥",
        description="Three consecutive accepted submissions with no rejection in between.",
        rarity="uncommon",
        eval_fn=_streak_3,
    ),
    BadgeRule(
        slug="kernel-speedrun",
        name="Kernel Speedrun",
        emoji="⚡",
        description="Verified an accepted proof in under 0.05 seconds of kernel time.",
        rarity="rare",
        eval_fn=_kernel_speedrun,
    ),
]

BADGE_BY_SLUG: dict[str, BadgeRule] = {r.slug: r for r in RULES}


# ---------- queries ----------

async def _persona_state(
    *, address: str, operator_address: str,
) -> dict[str, Any]:
    """Pull every accepted/rejected submission for `address` joined with
    its bounty's spec_yaml + status, plus computed convenience fields."""
    async with db._conn() as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            """SELECT s.*, b.spec_yaml, b.status AS bounty_status
               FROM submissions s
               JOIN bounties b ON b.id = s.bounty_id
               WHERE LOWER(s.solver_address) = LOWER(?)
               ORDER BY s.submitted_at""",
            (address,),
        ) as cur:
            submissions = [dict(r) for r in await cur.fetchall()]
        # First settled-bounty timestamp for this persona
        async with conn.execute(
            """SELECT MIN(s.submitted_at) AS first_settled_at
               FROM submissions s
               JOIN bounties b ON b.id = s.bounty_id
               WHERE LOWER(s.solver_address) = LOWER(?) AND b.status = 'settled'""",
            (address,),
        ) as cur:
            row = await cur.fetchone()
            first_settled_at = row["first_settled_at"] if row else None
    return {
        "submissions": submissions,
        "operator_address": operator_address,
        "first_settled_at": first_settled_at,
    }


async def compute_badges(
    *, address: str, operator_address: str,
) -> list[dict[str, Any]]:
    """Return earned-badge list for one persona address. Each entry:
    {slug, name, emoji, description, rarity, earned_at}."""
    state = await _persona_state(address=address, operator_address=operator_address)
    out: list[dict[str, Any]] = []
    for rule in RULES:
        ts = rule.eval_fn(state)
        if ts is None:
            continue
        out.append({
            "slug": rule.slug,
            "name": rule.name,
            "emoji": rule.emoji,
            "description": rule.description,
            "rarity": rule.rarity,
            "earned_at": ts,
        })
    out.sort(key=lambda b: b["earned_at"])
    return out


def all_rules() -> list[dict[str, Any]]:
    """Catalog of every defined badge — used by the dashboard's
    'unlockable' display so users can see what they could earn."""
    return [
        {
            "slug": r.slug,
            "name": r.name,
            "emoji": r.emoji,
            "description": r.description,
            "rarity": r.rarity,
        }
        for r in RULES
    ]

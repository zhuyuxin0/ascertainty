"""Bounty spec loader.

A bounty spec is a YAML file describing what proof is being bountied:
the theorem signature, the Lean4 toolchain required, the Mathlib SHA the
proof must build against, the allowed axioms, the USDC reward, and the
deadline + challenge window.

The canonical hash of a spec (sha256 over the JSON serialization with
sorted keys) is what gets escrowed on-chain in BountyFactory and what
the attestation binds to.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import yaml


REQUIRED_FIELDS = (
    "bounty_id",
    "theorem_signature",
    "mathlib_sha",
    "lean_toolchain",
    "axiom_whitelist",
    "bounty_usdc",
    "deadline_unix",
    "challenge_window_seconds",
)


class SpecError(ValueError):
    pass


@dataclass(frozen=True)
class BountySpec:
    bounty_id: str
    theorem_signature: str
    mathlib_sha: str
    lean_toolchain: str
    axiom_whitelist: tuple[str, ...]
    bounty_usdc: int
    deadline_unix: int
    challenge_window_seconds: int
    description: str = ""
    tags: tuple[str, ...] = field(default_factory=tuple)


def load_spec(path: str | Path) -> BountySpec:
    raw = yaml.safe_load(Path(path).read_text())
    if not isinstance(raw, dict):
        raise SpecError(f"spec must be a YAML mapping, got {type(raw).__name__}")
    return parse_spec(raw)


def parse_spec(raw: dict[str, Any]) -> BountySpec:
    missing = [f for f in REQUIRED_FIELDS if f not in raw]
    if missing:
        raise SpecError(f"missing required fields: {', '.join(missing)}")

    if not isinstance(raw["bounty_id"], str) or not raw["bounty_id"]:
        raise SpecError("bounty_id must be a non-empty string")
    if not isinstance(raw["theorem_signature"], str) or not raw["theorem_signature"]:
        raise SpecError("theorem_signature must be a non-empty string")
    if not isinstance(raw["mathlib_sha"], str) or len(raw["mathlib_sha"]) < 7:
        raise SpecError("mathlib_sha must be a string of at least 7 chars")
    if not isinstance(raw["lean_toolchain"], str) or not raw["lean_toolchain"]:
        raise SpecError("lean_toolchain must be a non-empty string")

    axioms = raw["axiom_whitelist"]
    if not isinstance(axioms, list) or not all(isinstance(a, str) for a in axioms):
        raise SpecError("axiom_whitelist must be a list of strings")

    if not isinstance(raw["bounty_usdc"], int) or raw["bounty_usdc"] <= 0:
        raise SpecError("bounty_usdc must be a positive integer (raw 6-decimal units)")
    if not isinstance(raw["deadline_unix"], int) or raw["deadline_unix"] <= 0:
        raise SpecError("deadline_unix must be a positive integer (unix seconds)")
    if not isinstance(raw["challenge_window_seconds"], int) or raw["challenge_window_seconds"] <= 0:
        raise SpecError("challenge_window_seconds must be a positive integer")

    tags = raw.get("tags", []) or []
    if not isinstance(tags, list) or not all(isinstance(t, str) for t in tags):
        raise SpecError("tags must be a list of strings")

    return BountySpec(
        bounty_id=raw["bounty_id"],
        theorem_signature=raw["theorem_signature"],
        mathlib_sha=raw["mathlib_sha"],
        lean_toolchain=raw["lean_toolchain"],
        axiom_whitelist=tuple(axioms),
        bounty_usdc=raw["bounty_usdc"],
        deadline_unix=raw["deadline_unix"],
        challenge_window_seconds=raw["challenge_window_seconds"],
        description=raw.get("description", "") or "",
        tags=tuple(tags),
    )


def spec_hash(spec: BountySpec) -> str:
    """sha256 over canonical JSON of the spec, hex digest (no 0x prefix)."""
    payload = asdict(spec)
    # tuples → lists for JSON canonicalization
    payload["axiom_whitelist"] = list(payload["axiom_whitelist"])
    payload["tags"] = list(payload["tags"])
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(blob).hexdigest()

"""Mock Lean4 verifier.

Stand-in for a real Lean4 kernel run. Real verification will spawn
`lake env lean --run check.lean` against the spec's pinned mathlib_sha
and lean_toolchain, then parse the kernel output. For the hackathon demo
we simulate that pipeline:

  - if the proof text contains the sentinel `-- ascertainty: reject`
    (case-insensitive) anywhere, the verifier rejects;
  - otherwise it accepts.
  - it sleeps `ASCERTAINTY_MOCK_VERIFIER_DELAY` seconds (default 1.0)
    to make the demo's racing visualization timing realistic.

The kernel output is a deterministic, human-readable string. Both the
proof text and the kernel output are sha256-hashed; those two hashes plus
the spec hash become the cryptographic anchor of the attestation.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import time
from dataclasses import dataclass

from backend.spec import BountySpec


REJECT_SENTINEL = "-- ascertainty: reject"


@dataclass(frozen=True)
class VerificationResult:
    accepted: bool
    kernel_output: str
    proof_hash: str
    axioms_used: tuple[str, ...]
    duration_seconds: float


async def verify(spec: BountySpec, proof_text: str) -> VerificationResult:
    delay = float(os.getenv("ASCERTAINTY_MOCK_VERIFIER_DELAY", "1.0"))
    started = time.monotonic()
    await asyncio.sleep(delay)

    rejected = REJECT_SENTINEL.lower() in proof_text.lower()
    accepted = not rejected
    duration = time.monotonic() - started

    proof_hash = hashlib.sha256(proof_text.encode()).hexdigest()
    axioms = spec.axiom_whitelist

    result_word = "ACCEPT" if accepted else "REJECT"
    reason = "" if accepted else "  reason: rejection sentinel matched in proof body\n"
    kernel_output = (
        f"Lean 4 kernel (ascertainty mock) v0.1\n"
        f"  toolchain: {spec.lean_toolchain}\n"
        f"  mathlib_sha: {spec.mathlib_sha}\n"
        f"  theorem_signature: {spec.theorem_signature.strip().splitlines()[0][:120]}\n"
        f"  axioms_allowed: {', '.join(axioms) if axioms else '(none beyond empty set)'}\n"
        f"  proof_sha256: {proof_hash}\n"
        f"  result: {result_word}\n"
        f"{reason}"
        f"  duration_seconds: {duration:.3f}\n"
    )

    return VerificationResult(
        accepted=accepted,
        kernel_output=kernel_output,
        proof_hash=proof_hash,
        axioms_used=axioms,
        duration_seconds=duration,
    )

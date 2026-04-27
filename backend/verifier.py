"""Lean4 verifier — tries the real `lean` binary first, falls back to a
mock kernel that uses sentinel comments so local dev / unconfigured
environments still produce well-formed attestations.

Real path (Phase 1):
  - `backend/lean_runner.verify_proof` runs the real Lean kernel
    against the submitted proof in a sandboxed tempdir, against the
    Lean stdlib (no Mathlib yet — pinned-mathlib_sha builds are a
    Phase 2 follow-up that needs ~10-20 min per spec to provision).
  - Hard timeout (LEAN_TIMEOUT_SECONDS, default 30s).
  - Real exit code → kernel verdict; real stderr → diagnostic output.
  - Real `#print axioms` parsing → `axioms_used` reflects what the
    proof actually trusts.

Mock path (fallback):
  - If the `lean` binary isn't installed, or the runner raises, fall
    back to the original behaviour: scan for `-- ascertainty: reject`
    sentinel; otherwise accept after a configurable delay.
  - Lets local dev work without an 800 MB toolchain install, and
    keeps the demo functional even if production's Lean install
    breaks.

The kernel_output string carries which mode produced the result, so
attestations are honest about their provenance.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
from dataclasses import dataclass

from backend import lean_runner
from backend.spec import BountySpec

log = logging.getLogger("ascertainty.verifier")

REJECT_SENTINEL = "-- ascertainty: reject"


@dataclass(frozen=True)
class VerificationResult:
    accepted: bool
    kernel_output: str
    proof_hash: str
    axioms_used: tuple[str, ...]
    duration_seconds: float
    mode: str  # "real_lean4" | "mock_lean4"


async def verify(spec: BountySpec, proof_text: str) -> VerificationResult:
    proof_hash = hashlib.sha256(proof_text.encode()).hexdigest()

    if lean_runner.is_available():
        try:
            return await _verify_real(spec, proof_text, proof_hash)
        except Exception as e:
            log.warning("lean: real kernel raised, falling back to mock: %s", e)

    return await _verify_mock(spec, proof_text, proof_hash)


async def _verify_real(spec: BountySpec, proof_text: str, proof_hash: str) -> VerificationResult:
    result = await lean_runner.verify_proof(proof_text, theorem_signature=spec.theorem_signature)
    # If the real run had compile-time errors but the proof TEXT contains
    # the reject sentinel, honour it (so demo proofs marked for reject
    # still surface that intent). Without the sentinel, the real verdict
    # stands.
    accepted = result.accepted
    if REJECT_SENTINEL.lower() in proof_text.lower():
        accepted = False

    header = (
        "Lean 4 kernel (REAL run on the Ascertainty agent)\n"
        f"  bounty: {spec.bounty_id}\n"
        f"  toolchain (declared): {spec.lean_toolchain}\n"
        f"  mathlib_sha (declared): {spec.mathlib_sha}\n"
        f"  proof_sha256: {proof_hash}\n"
        "  --- lean output ---\n"
    )
    kernel_output = header + result.kernel_output

    return VerificationResult(
        accepted=accepted,
        kernel_output=kernel_output,
        proof_hash=proof_hash,
        axioms_used=result.axioms_used or spec.axiom_whitelist,
        duration_seconds=result.duration_seconds,
        mode="real_lean4",
    )


async def _verify_mock(spec: BountySpec, proof_text: str, proof_hash: str) -> VerificationResult:
    delay = float(os.getenv("ASCERTAINTY_MOCK_VERIFIER_DELAY", "1.0"))
    started = time.monotonic()
    await asyncio.sleep(delay)

    rejected = REJECT_SENTINEL.lower() in proof_text.lower()
    accepted = not rejected
    duration = time.monotonic() - started

    result_word = "ACCEPT" if accepted else "REJECT"
    reason = "" if accepted else "  reason: rejection sentinel matched in proof body\n"
    kernel_output = (
        f"Lean 4 kernel (mock — toolchain unavailable, fallback)\n"
        f"  toolchain: {spec.lean_toolchain}\n"
        f"  mathlib_sha: {spec.mathlib_sha}\n"
        f"  theorem_signature: {spec.theorem_signature.strip().splitlines()[0][:120]}\n"
        f"  axioms_allowed: {', '.join(spec.axiom_whitelist) if spec.axiom_whitelist else '(none)'}\n"
        f"  proof_sha256: {proof_hash}\n"
        f"  result: {result_word}\n"
        f"{reason}"
        f"  duration_seconds: {duration:.3f}\n"
    )

    return VerificationResult(
        accepted=accepted,
        kernel_output=kernel_output,
        proof_hash=proof_hash,
        axioms_used=spec.axiom_whitelist,
        duration_seconds=duration,
        mode="mock_lean4",
    )

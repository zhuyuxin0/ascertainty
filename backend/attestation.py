"""Attestation builder + signer.

An attestation is a deterministic JSON record of one verification run. It
binds (spec_hash, proof_hash, kernel_output_hash, result, timestamp) under
an EIP-191 personal_sign signature from the operator wallet, which is
what BountyFactory.submitProof later commits to on-chain.

The on-chain `attestationHash` argument should be set to the bytes32
keccak/sha256 of the JSON below; the off-chain JSON itself goes to 0G
Storage so anyone can fetch and re-verify. We use sha256 (not keccak) for
the canonical attestation_hash because Python stdlib has it and 0G
Storage indexes by sha256-derived Merkle roots; on-chain we just store
the bytes32.
"""
from __future__ import annotations

import hashlib
import json
import time
from typing import Any

from eth_account import Account
from eth_account.messages import encode_defunct

from backend.spec import BountySpec, spec_hash
from backend.verifier import VerificationResult


ATTESTATION_VERSION = "1"
VERIFIER_BASE_ID = "ascertainty-lean4"


def build_attestation(spec: BountySpec, result: VerificationResult) -> dict[str, Any]:
    """Build the unsigned attestation dict (no signature yet).

    The `verifier` field carries the mode (`real_lean4` or `mock_lean4`)
    so any consumer of the attestation can tell whether it came from a
    real Lean kernel run or the sentinel-based fallback.
    """
    kernel_output_hash = hashlib.sha256(result.kernel_output.encode()).hexdigest()
    verifier_id = f"{VERIFIER_BASE_ID}-{result.mode}-v0.2"
    return {
        "version": ATTESTATION_VERSION,
        "verifier": verifier_id,
        "verifier_mode": result.mode,
        "bounty_id": spec.bounty_id,
        "spec_hash": spec_hash(spec),
        "proof_hash": result.proof_hash,
        "kernel_output_hash": kernel_output_hash,
        "lean_toolchain": spec.lean_toolchain,
        "mathlib_sha": spec.mathlib_sha,
        "axioms_used": list(result.axioms_used),
        "result": "accept" if result.accepted else "reject",
        "duration_seconds": round(result.duration_seconds, 6),
        "timestamp": int(time.time()),
    }


def attestation_hash(attestation: dict[str, Any]) -> str:
    """sha256 hex digest of canonical JSON of the unsigned attestation."""
    blob = json.dumps(_canonical(attestation), sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(blob).hexdigest()


def sign_attestation(attestation: dict[str, Any], private_key_hex: str) -> dict[str, Any]:
    """Add `attestation_hash`, `signature`, `signer` to the attestation.

    Signs the attestation_hash via EIP-191 personal_sign. Recoverable
    on-chain via ecrecover(keccak(\\x19Ethereum Signed Message:\\n64 || hex), v, r, s).
    """
    h = attestation_hash(attestation)
    account = Account.from_key(private_key_hex)
    msg = encode_defunct(text=h)
    signed = account.sign_message(msg)
    return {
        **attestation,
        "attestation_hash": h,
        "signature": signed.signature.hex(),
        "signer": account.address,
    }


def recover_signer(signed_attestation: dict[str, Any]) -> str:
    """Independently recover the signer address — used in tests/verifications."""
    h = signed_attestation["attestation_hash"]
    sig = signed_attestation["signature"]
    if not sig.startswith("0x"):
        sig = "0x" + sig
    msg = encode_defunct(text=h)
    return Account.recover_message(msg, signature=sig)


def _canonical(d: dict[str, Any]) -> dict[str, Any]:
    """Strip signature-side fields so attestation_hash is stable across (un)signed."""
    return {k: v for k, v in d.items() if k not in ("attestation_hash", "signature", "signer")}

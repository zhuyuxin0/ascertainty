"""Ascertainty CLI.

Usage:
  python -m cli.ascertainty verify --spec PATH --proof PATH \\
      [--no-upload] [--no-explain] [--out PATH]

Loads a bounty spec, runs the (mock) Lean4 verifier on the proof,
builds + signs an attestation with the operator's OG_PRIVATE_KEY, and
prints the final JSON. Best-effort uploads the attestation to 0G Storage
and best-effort attaches a TEE-verified explanation from 0G Compute,
unless suppressed via flags.

Exit codes:
  0 — verification ran (regardless of accept/reject); attestation printed
  1 — usage error / spec parse error / signing key missing
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from backend.attestation import build_attestation, sign_attestation
from backend.og_compute import explain_verification
from backend.og_storage import upload_attestation
from backend.spec import load_spec
from backend.verifier import verify


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="ascertainty",
        description="Ascertainty verification oracle CLI",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    v = sub.add_parser("verify", help="run mock Lean4 verifier on a proof against a spec")
    v.add_argument("--spec", required=True, type=Path, help="path to bounty spec YAML")
    v.add_argument("--proof", required=True, type=Path, help="path to .lean proof file")
    v.add_argument("--no-upload", action="store_true",
                   help="skip uploading attestation to 0G Storage")
    v.add_argument("--no-explain", action="store_true",
                   help="skip 0G Compute explanation")
    v.add_argument("--out", type=Path, default=None,
                   help="write attestation JSON to PATH (default: stdout)")
    return p


async def _run_verify(args: argparse.Namespace) -> int:
    load_dotenv()
    private_key = os.getenv("OG_PRIVATE_KEY")
    if not private_key:
        print("error: OG_PRIVATE_KEY not set in environment / .env", file=sys.stderr)
        return 1

    spec = load_spec(args.spec)
    proof_text = args.proof.read_text()

    result = await verify(spec, proof_text)
    unsigned = build_attestation(spec, result)
    signed = sign_attestation(unsigned, private_key)

    storage_field: dict | None = None
    if not args.no_upload:
        storage = await upload_attestation(signed)
        if storage is not None:
            storage_field = {
                "root_hash": storage.root_hash,
                "tx_hash": storage.tx_hash,
                "uploaded_at": storage.uploaded_at,
            }

    explanation: str | None = None
    if not args.no_explain:
        explanation = await explain_verification(spec, result)

    output = {
        "attestation": signed,
        "storage": storage_field,
        "explanation": explanation,
        "kernel_output": result.kernel_output,
    }

    text = json.dumps(output, indent=2, sort_keys=False)
    if args.out:
        args.out.write_text(text + "\n")
        print(f"wrote attestation to {args.out}", file=sys.stderr)
    else:
        print(text)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    if args.cmd == "verify":
        return asyncio.run(_run_verify(args))
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())

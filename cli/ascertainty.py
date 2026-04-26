"""Ascertainty CLI.

Subcommands:
  verify     — run the mock Lean4 verifier on a proof against a spec
  bootstrap  — one-time MockUSDC mint + BountyFactory approve for the operator wallet

Exit codes:
  0 — success
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

from backend import og_chain, publisher
from backend.attestation import build_attestation, sign_attestation
from backend.og_compute import explain_verification
from backend.og_storage import upload_attestation
from backend.spec import load_spec
from backend.verifier import verify


MAX_UINT256 = 2**256 - 1
MIN_USDC_BALANCE = 1_000_000_000_000   # 1,000,000 USDC (6 decimals)
MIN_APPROVAL = 2**255                  # any value above 2^255 is "effectively infinite"


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

    sub.add_parser(
        "bootstrap",
        help="one-time setup: mint MockUSDC to operator + approve BountyFactory",
    )
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


async def _run_bootstrap(args: argparse.Namespace) -> int:
    load_dotenv()
    if not og_chain.is_configured():
        print("error: OG_PRIVATE_KEY missing or contract_addresses.json not found",
              file=sys.stderr)
        return 1

    account = og_chain.get_account()
    usdc = og_chain.get_usdc()
    factory = og_chain.get_factory()

    bal = await usdc.functions.balanceOf(account.address).call()
    print(f"operator         : {account.address}")
    print(f"MockUSDC@        : {usdc.address}")
    print(f"BountyFactory@   : {factory.address}")
    print(f"current balance  : {bal} ({bal / 1_000_000} USDC)")

    if bal < MIN_USDC_BALANCE:
        amount = MIN_USDC_BALANCE - bal
        print(f"minting          : {amount} ({amount / 1_000_000} USDC)")
        fn = usdc.functions.mint(account.address, amount)
        tx_hash, block, _ = await publisher._send_tx(fn)
        print(f"  mint tx        : {tx_hash} (block {block})")
        bal = await usdc.functions.balanceOf(account.address).call()
        print(f"new balance      : {bal} ({bal / 1_000_000} USDC)")
    else:
        print("balance OK, no mint needed")

    allowance = await usdc.functions.allowance(account.address, factory.address).call()
    print(f"current allowance: {allowance}")
    if allowance < MIN_APPROVAL:
        print(f"approving        : max_uint256 to BountyFactory")
        fn = usdc.functions.approve(factory.address, MAX_UINT256)
        tx_hash, block, _ = await publisher._send_tx(fn)
        print(f"  approve tx     : {tx_hash} (block {block})")
        allowance = await usdc.functions.allowance(account.address, factory.address).call()
        print(f"new allowance    : {allowance}")
    else:
        print("allowance OK, no approval needed")

    print("bootstrap complete")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    if args.cmd == "verify":
        return asyncio.run(_run_verify(args))
    if args.cmd == "bootstrap":
        return asyncio.run(_run_bootstrap(args))
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())

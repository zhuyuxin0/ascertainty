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
import time
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

    sr = sub.add_parser(
        "submit-relayed",
        help="end-to-end: generate ephemeral solver, sign attestation, POST "
             "/bounty/submit with signature → operator relays via submitProofFor",
    )
    sr.add_argument("--api", default="http://localhost:8000",
                    help="backend base URL (default http://localhost:8000)")
    sr.add_argument("--bounty-id", type=int, required=True,
                    help="DB bounty id (must already be on-chain)")
    sr.add_argument("--proof", required=True, type=Path,
                    help="path to .lean proof file the solver wants to submit")
    sr.add_argument("--solver-key", default=None,
                    help="hex private key for the solver (omit to generate fresh)")

    sr = sub.add_parser(
        "seed-race",
        help="insert a 60s scripted race into race_events for the dashboard demo",
    )
    sr.add_argument("bounty_id", type=int, help="DB id of the bounty to seed events for")
    sr.add_argument("--solvers", type=int, default=3, choices=[2, 3],
                    help="number of solver cars (2 or 3, default 3)")
    sr.add_argument("--duration", type=int, default=60,
                    help="seconds of race time to script (default 60)")

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


async def _run_seed_race(args: argparse.Namespace) -> int:
    load_dotenv()
    from backend import db
    import aiosqlite

    bounty = await db.get_bounty(args.bounty_id)
    if bounty is None:
        print(f"error: bounty {args.bounty_id} not found", file=sys.stderr)
        return 1

    # Wipe any prior events for this bounty so the replay starts clean.
    async with db._conn() as conn:
        cur = await conn.execute(
            "DELETE FROM race_events WHERE bounty_id = ?", (args.bounty_id,),
        )
        await conn.commit()
        if cur.rowcount:
            print(f"cleared {cur.rowcount} prior race events for bounty {args.bounty_id}")

    now = int(time.time())
    n = args.solvers
    duration = args.duration

    # Three solver wallets — distinct so the dashboard can color them differently.
    solvers = [
        "0xc01D000000000000000000000000000000000001",  # finisher
        "0xc01D000000000000000000000000000000000002",  # crashes mid-way
        "0xc01D000000000000000000000000000000000003",  # backtracks then finishes
    ][:n]

    inserted = 0

    # 30 progress checkpoints per solver, evenly spaced across `duration`
    # (more checkpoints = visually smoother motion in the dashboard replay)
    CHECKPOINTS = 30
    for solver_idx, solver in enumerate(solvers):
        for step in range(1, CHECKPOINTS + 1):
            ts = now + int(step * duration / CHECKPOINTS)
            ts += solver_idx * 1  # slight stagger between cars
            await db.insert_race_event(
                bounty_id=args.bounty_id,
                solver_address=solver,
                event_type="progress",
                data_json=json.dumps({"checkpoint": step, "fraction": step / CHECKPOINTS}),
                ts=ts,
            )
            inserted += 1

    # Solver 3: backtracks at ~40% then catches up
    if n >= 3:
        await db.insert_race_event(
            bounty_id=args.bounty_id,
            solver_address=solvers[2],
            event_type="backtrack",
            data_json=json.dumps({"to_checkpoint": int(0.3 * CHECKPOINTS)}),
            ts=now + int(0.4 * duration) + 1,
        )
        inserted += 1
        # Pit stop right after backtrack
        await db.insert_race_event(
            bounty_id=args.bounty_id,
            solver_address=solvers[2],
            event_type="pit",
            data_json=json.dumps({"reason": "refactor"}),
            ts=now + int(0.5 * duration),
        )
        inserted += 1

    # Solver 2: crashes at ~70%
    if n >= 2:
        await db.insert_race_event(
            bounty_id=args.bounty_id,
            solver_address=solvers[1],
            event_type="crash",
            data_json=json.dumps({"at_checkpoint": int(0.7 * CHECKPOINTS), "reason": "kernel rejected axiom"}),
            ts=now + int(0.7 * duration) + 2,
        )
        inserted += 1

    # Solver 0: finishes
    await db.insert_race_event(
        bounty_id=args.bounty_id,
        solver_address=solvers[0],
        event_type="finish",
        data_json=json.dumps({"final_time_seconds": duration}),
        ts=now + duration,
    )
    inserted += 1

    print(f"inserted {inserted} race events for bounty {args.bounty_id} ({n} solvers, {duration}s)")
    print(f"first event at: {now}, last at: {now + duration}")
    print(f"open dashboard: http://localhost:3000/race/{args.bounty_id}")
    return 0


async def _run_submit_relayed(args: argparse.Namespace) -> int:
    """Demonstrate the gasless solver-relayer flow.

    1. Build the unsigned attestation locally (so we know its hash without
       trusting the server).
    2. GET /bounty/<id>/submit-message?attestation_hash=<hash> — server
       returns the keccak256 message.
    3. Solver private key signs that message via EIP-191 personal_sign.
    4. POST /bounty/submit with `signature` set — operator wallet relays
       on-chain via BountyFactory.submitProofFor. Solver pays no gas.
    """
    load_dotenv()
    import secrets
    import httpx
    from eth_account import Account
    from eth_account.messages import encode_defunct

    operator_key = os.getenv("OG_PRIVATE_KEY")
    if not operator_key:
        print("error: OG_PRIVATE_KEY not set (server uses it to attest + relay)",
              file=sys.stderr)
        return 1

    # 1) verify locally to compute the attestation hash deterministically
    from backend.attestation import build_attestation, sign_attestation
    from backend.spec import parse_spec
    import yaml as _yaml

    async with httpx.AsyncClient(base_url=args.api, timeout=120.0) as client:
        r = await client.get(f"/bounty/{args.bounty_id}/status")
        r.raise_for_status()
        status = r.json()
        spec = parse_spec(_yaml.safe_load(status["bounty"]["spec_yaml"]))
        proof_text = args.proof.read_text()
        result = await verify(spec, proof_text)
        if not result.accepted:
            print(f"verifier rejected proof — would never reach chain")
            return 1
        unsigned = build_attestation(spec, result)
        signed = sign_attestation(unsigned, operator_key)
        attestation_hash = "0x" + signed["attestation_hash"]
        print(f"attestation_hash : {attestation_hash}")

        # 2) ask server for the message_hash to sign
        r = await client.get(
            f"/bounty/{args.bounty_id}/submit-message",
            params={"attestation_hash": attestation_hash},
        )
        r.raise_for_status()
        msg = r.json()
        message_hash = bytes.fromhex(msg["message_hash"].removeprefix("0x"))
        print(f"message_hash     : 0x{message_hash.hex()}")

        # 3) ephemeral solver signs
        if args.solver_key:
            solver_acct = Account.from_key(args.solver_key.removeprefix("0x"))
            print(f"solver           : {solver_acct.address} (provided)")
        else:
            solver_acct = Account.from_key("0x" + secrets.token_hex(32))
            print(f"solver           : {solver_acct.address} (ephemeral)")
        signed_msg = solver_acct.sign_message(encode_defunct(message_hash))
        sig_hex = signed_msg.signature.hex()
        print(f"signature        : 0x{sig_hex}")

        # 4) submit — pass our locally-computed attestation_hash so the on-chain
        # submitProofFor call matches the message the solver signed
        r = await client.post(
            "/bounty/submit",
            json={
                "bounty_id": args.bounty_id,
                "solver_address": solver_acct.address,
                "proof": proof_text,
                "signature": sig_hex,
                "attestation_hash": attestation_hash,
            },
        )
        r.raise_for_status()
        resp = r.json()
        print(json.dumps(resp, indent=2))
        if (resp.get("onchain") or {}).get("via") == "submitProofFor":
            print("\n✓ relayed via BountyFactory.submitProofFor — solver paid no gas")
        return 0


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    if args.cmd == "verify":
        return asyncio.run(_run_verify(args))
    if args.cmd == "bootstrap":
        return asyncio.run(_run_bootstrap(args))
    if args.cmd == "seed-race":
        return asyncio.run(_run_seed_race(args))
    if args.cmd == "submit-relayed":
        return asyncio.run(_run_submit_relayed(args))
    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())

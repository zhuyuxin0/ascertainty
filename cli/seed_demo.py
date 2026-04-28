"""Populate the live backend with a demo-ready set of bounties.

Creates one bounty per example spec, submits proofs to a couple, lets
one fully settle. Leaves at least one in `open`, one in `submitted`,
and one in `settled` so the /bounties grid + /race pages always show
the full status spectrum.

Usage (against prod):
    venv/bin/python -m cli.seed_demo --base https://api.ascertainty.xyz

Usage (against local):
    venv/bin/python -m cli.seed_demo
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

import yaml


SPECS_DIR = Path(__file__).resolve().parent.parent / "specs" / "examples"
DEFAULT_POSTER = "0xd932Aad9adA0B879f4654CD88071895085Fad0d0"


def post_json(base: str, path: str, body: dict, timeout: int = 240) -> dict:
    req = urllib.request.Request(
        f"{base}{path}",
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body[:300]}") from e


def get_json(base: str, path: str, timeout: int = 30) -> dict:
    with urllib.request.urlopen(f"{base}{path}", timeout=timeout) as r:
        return json.load(r)


def load_spec_with_overrides(name: str, **overrides) -> str:
    path = SPECS_DIR / f"{name}.yaml"
    raw = yaml.safe_load(path.read_text())
    raw.update(overrides)
    # Suffix bounty_id with timestamp so re-runs don't collide on spec_hash
    raw["bounty_id"] = f"{raw['bounty_id']}-{int(time.time())}"
    return yaml.safe_dump(raw, sort_keys=False)


def create_bounty(base: str, spec_yaml: str, poster: str) -> dict:
    return post_json(base, "/bounty/create", {
        "spec_yaml": spec_yaml,
        "poster_address": poster,
    })


def submit_proof(base: str, bounty_id: int, solver: str, proof_text: str) -> dict:
    return post_json(base, "/bounty/submit", {
        "bounty_id": bounty_id,
        "solver_address": solver,
        "proof": proof_text,
        "upload": True,
        "explain": True,
    })


def submit_as_persona(base: str, bounty_id: int, persona_slug: str, proof_text: str) -> dict:
    """Server-side helper: backend signs the attestation hash with the
    persona's stored privkey and routes through submitProofFor. Lets the
    seeded demo races have three distinct on-chain solvers."""
    return post_json(base, "/bounty/submit", {
        "bounty_id": bounty_id,
        "proof": proof_text,
        "persona_slug": persona_slug,
        "upload": True,
        "explain": True,
    })


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="seed-demo")
    p.add_argument("--base", default="http://127.0.0.1:8000",
                   help="backend base URL (default local)")
    p.add_argument("--poster", default=DEFAULT_POSTER,
                   help="poster wallet address (default operator)")
    args = p.parse_args(argv)

    print(f"==> seeding {args.base}")
    health = get_json(args.base, "/health")
    print(f"  backend health: {health.get('status')}")

    now = int(time.time())

    # Plan:
    #  - sort_correctness     → create + submit proof + wait → SETTLED
    #  - mathlib_gap          → create + submit proof       → SUBMITTED
    #  - erc20_invariant      → create only                  → OPEN
    #  - heat_equation        → create only                  → OPEN
    seeds = [
        ("sort_correctness", {
            "deadline_unix": now + 60 * 60,
            "challenge_window_seconds": 20,
        }, "settle"),
        ("mathlib_gap", {
            "deadline_unix": now + 60 * 60 * 6,
            "challenge_window_seconds": 60,
        }, "submit"),
        ("erc20_invariant", {
            "deadline_unix": now + 60 * 60 * 24 * 30,
            "challenge_window_seconds": 1800,
        }, "open"),
        ("heat_equation", {
            "deadline_unix": now + 60 * 60 * 24 * 7,
            "challenge_window_seconds": 600,
        }, "open"),
    ]

    created = []
    for spec_name, overrides, plan in seeds:
        print(f"\n-- {spec_name} (plan: {plan}) --")
        spec_yaml = load_spec_with_overrides(spec_name, **overrides)
        try:
            res = create_bounty(args.base, spec_yaml, args.poster)
        except Exception as e:
            print(f"  create failed: {e}")
            continue
        bid = res["bounty_id"]
        onchain_id = (res.get("onchain") or {}).get("onchain_bounty_id")
        print(f"  bounty {bid}: onchain {onchain_id}")
        created.append((bid, spec_name, plan))

        if plan in ("submit", "settle"):
            # The 'settle' bounty is solved by Aggressive Andy (he claims first);
            # 'submit' (still in challenge window) is solved by Careful Carl.
            persona = "aggressive-andy" if plan == "settle" else "careful-carl"
            try:
                sub = submit_as_persona(args.base, bid, persona, "theorem t : True := trivial")
                tx = (sub.get("onchain") or {}).get("tx_hash")
                via = (sub.get("onchain") or {}).get("via", "?")
                print(f"  {persona} submitted: result={sub['attestation']['result']} via={via} tx={tx[:18] + '...' if tx else 'n/a'}")
            except Exception as e:
                print(f"  submit failed: {e}")

    # Wait for the settle bounty to actually settle (challenge_window_seconds=20 + auto-claim 30s tick)
    print("\n==> waiting up to 90s for the 'settle' bounty to claim on-chain...")
    settle_id = next((b for b, _, plan in created if plan == "settle"), None)
    if settle_id:
        for i in range(18):
            time.sleep(5)
            try:
                st = get_json(args.base, f"/bounty/{settle_id}/status")
                status = st["bounty"]["status"]
                print(f"  poll {i+1}: status={status}")
                if status == "settled":
                    print("  ✓ settled")
                    break
            except Exception as e:
                print(f"  poll error: {e}")

    print("\n==> summary")
    for bid, spec_name, plan in created:
        try:
            st = get_json(args.base, f"/bounty/{bid}/status")
            status = st["bounty"]["status"]
            sub_count = len(st.get("submissions", []))
            print(f"  bounty {bid:>3} ({spec_name:18}) [{plan:>6}]: status={status} submissions={sub_count}")
        except Exception as e:
            print(f"  bounty {bid:>3} ({spec_name}): poll error {e}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

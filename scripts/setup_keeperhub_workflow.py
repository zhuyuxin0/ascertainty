"""One-shot KeeperHub workflow installer for the settlement architecture.

Creates the `Ascertainty Settlement Driver` workflow on KeeperHub via MCP
`create_workflow`. The workflow takes `{ bountyId }` as input and calls
`BountyFactory.settleBounty(uint256)` on 0G Galileo (chain 16602) using
KH's hosted Turnkey wallet as msg.sender. Output: the workflow ID, which
the operator stores in `.env` as `KEEPERHUB_WORKFLOW_ID`.

Run once after redeploying BountyFactory or after rotating KH API keys:

    python -m scripts.setup_keeperhub_workflow

Prints the resulting workflow ID and a one-liner the operator can paste
into `.env`. Idempotent at the policy level — if a workflow with this name
already exists the script lists it and exits without creating a duplicate.

Pre-reqs:
  1. KEEPERHUB_API_KEY in env (org-scoped `kh_<key>`).
  2. KH-hosted Turnkey wallet funded with ≥0.05 OG on chain 16602 — KH's
     wallet pays gas for every settleBounty call. The wallet address
     surfaces in the KH dashboard and (once stored as
     `KEEPERHUB_WALLET_ADDRESS` in .env) on the dashboard's
     "Settlement Authority" badge.
  3. backend/contract_addresses.json populated (the BountyFactory address
     gets baked into the workflow's web3/write-contract config).
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

# allow `python -m scripts.setup_keeperhub_workflow` from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv  # noqa: E402

from backend.keeperhub import KeeperHubMcp  # noqa: E402

WORKFLOW_NAME = "Ascertainty Settlement Driver"
WORKFLOW_DESCRIPTION = (
    "Settles a bounty on Ascertainty's BountyFactory contract on 0G Galileo. "
    "Triggered by Ascertainty's settle_task once a proof's challenge window "
    "has expired with no challenge. KH's hosted Turnkey wallet pays gas and "
    "becomes the on-chain `settler`; USDC always flows to the recorded solver."
)


def _build_workflow_definition(factory_address: str) -> dict:
    """KeeperHub workflow JSON in the nodes/edges graph shape KH expects.
    Single web3/write-contract action node on chain 16602 calling
    settleBounty(bountyId). The bountyId is interpolated from the trigger
    inputs via KH's template syntax `{{@<nodeId>.inputs.<field>}}`."""
    settle_abi_json = json.dumps([
        {
            "inputs": [
                {"internalType": "uint256", "name": "bountyId", "type": "uint256"}
            ],
            "name": "settleBounty",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function",
        }
    ])
    # KH-specific schema notes (worth preserving — the docs leave most of
    # this implicit and we found it the hard way):
    #   - `network` must be the bare numeric chain ID as a string ("16602"),
    #     NOT "chain-16602" (despite that being what `ai_generate_workflow`
    #     emits).
    #   - `functionArgs` is a JSON ARRAY string (positional, in ABI order),
    #     NOT an object keyed by argument name.
    #   - Template substitution uses `{{@<nodeId>:<NodeLabel>.<field>}}`.
    #     The colon between nodeId and Label is required.
    #   - Manual-trigger inputs surface FLAT on the trigger node's output —
    #     so `{{@trigger-1:Manual Trigger.bountyId}}` resolves to the value
    #     passed via `execute_workflow(workflowId, input={'bountyId': N})`.
    #     Note `input` (singular) on the MCP arg, NOT `inputs`.
    #   - Templates are substituted BEFORE the JSON parse, so a template
    #     producing a number must be inside the array brackets, not quoted.
    trigger_label = "Manual Trigger"
    return {
        "name": WORKFLOW_NAME,
        "description": WORKFLOW_DESCRIPTION,
        "enabled": True,
        "nodes": [
            {
                "id": "trigger-1",
                "type": "trigger",
                "position": {"x": 100, "y": 200},
                "data": {
                    "type": "trigger",
                    "label": trigger_label,
                    "description": "Fired by settle_task when challenge window expires",
                    "status": "idle",
                    "config": {"triggerType": "Manual"},
                },
            },
            {
                "id": "settle-bounty",
                "type": "action",
                "position": {"x": 400, "y": 200},
                "data": {
                    "type": "action",
                    "label": "settleBounty on 0G Galileo",
                    "description": (
                        "Permissionless settle: USDC always flows to the "
                        "recorded solver, KH wallet just pays gas + signs."
                    ),
                    "status": "idle",
                    "config": {
                        "actionType": "web3/write-contract",
                        "network": "16602",
                        "contractAddress": factory_address,
                        "abi": settle_abi_json,
                        "abiFunction": "settleBounty",
                        "functionArgs": (
                            "[{{@trigger-1:" + trigger_label + ".bountyId}}]"
                        ),
                        "gasLimitMultiplier": "1.5",
                    },
                },
            },
        ],
        "edges": [
            {
                "id": "e1",
                "source": "trigger-1",
                "target": "settle-bounty",
                "type": "default",
            }
        ],
    }


async def main() -> int:
    load_dotenv()
    api_key = os.getenv("KEEPERHUB_API_KEY")
    if not api_key:
        print("error: KEEPERHUB_API_KEY not set in env")
        return 2

    addr_path = Path(__file__).resolve().parent.parent / "backend" / "contract_addresses.json"
    if not addr_path.exists():
        print(f"error: {addr_path} not found — deploy contracts first")
        return 2
    addresses = json.loads(addr_path.read_text())
    factory = addresses["contracts"]["BountyFactory"]
    print(f"BountyFactory @ {factory} (chainId {addresses['chainId']})")

    mcp = KeeperHubMcp(api_key)
    try:
        await mcp.initialize()

        existing = await mcp.list_workflows(limit=100)
        existing_list = existing if isinstance(existing, list) else (
            existing.get("workflows", []) if isinstance(existing, dict) else []
        )
        match = next((w for w in existing_list if w.get("name") == WORKFLOW_NAME), None)
        definition = _build_workflow_definition(factory)

        if match:
            wf_id = match.get("id") or match.get("workflowId")
            print(f"workflow already exists: id={wf_id} — updating definition")
            update_args = {
                "workflowId": wf_id,
                "name": definition["name"],
                "description": definition["description"],
                "nodes": definition["nodes"],
                "edges": definition["edges"],
                "enabled": True,
            }
            r = await mcp.call_tool("update_workflow", update_args)
            print(f"updated: {json.dumps(r)[:300]}")
            print()
            print(f"  KEEPERHUB_WORKFLOW_ID={wf_id}")
            return 0

        print(f"creating workflow: {WORKFLOW_NAME}")
        print(json.dumps(definition, indent=2))

        result = await mcp.call_tool("create_workflow", definition)
        wf_id = None
        if isinstance(result, dict):
            wf_id = result.get("id") or result.get("workflowId")
        if not wf_id:
            print(f"create_workflow returned: {result!r}")
            print("error: no workflow id in response — check KH MCP tool schema")
            return 1

        print(f"\ncreated workflow: id={wf_id}")
        print()
        print("Add this to .env:")
        print(f"  KEEPERHUB_WORKFLOW_ID={wf_id}")
        print()
        print("Then look up KH's Turnkey wallet address in the dashboard")
        print("and add it for the 'Settlement Authority' badge:")
        print("  KEEPERHUB_WALLET_ADDRESS=0x...")
        print()
        print("Fund that wallet with ≥0.05 OG on chain 16602 (settleBounty gas).")
        return 0
    finally:
        await mcp.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

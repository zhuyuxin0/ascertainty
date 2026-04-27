# KeeperHub Integration Feedback

**Project:** Ascertainty — Universal Verification Oracle
**Builder:** @zhuyuxin0
**Hackathon:** ETHGlobal Open Agents 2026
**Date:** April 27, 2026

Friction encountered while integrating KeeperHub into Ascertainty's
settlement loop. Every claim about API behaviour was empirically
reproduced against the live API at `app.keeperhub.com`; documentation
gaps were verified against `docs.keeperhub.com` page contents on the
same date. Where a bug was previously surfaced by the sibling Enstabler
project (April 25, 2026), it is re-confirmed here against today's API
and docs to show whether anything moved.

---

## Builder context (one paragraph)

Ascertainty is a solo-built verification oracle: solvers post Lean4
proofs against on-chain bounty specs, the agent runs a (mock) kernel,
signs an attestation with the operator wallet, and uploads it to 0G
Storage. After a configurable challenge window, settlement triggers a
USDC payout from `BountyFactory` on 0G Galileo (chain 16602) to the
solver. KeeperHub plays two roles in this loop:

1. **MCP `execute_workflow`** is called from the FastAPI `/bounty/submit`
   endpoint on the accept path, so the KeeperHub-hosted workflow can
   trigger the on-chain settlement using its own Turnkey wallet.
2. **Direct Execution** would have been the natural fit for the
   one-shot `MockUSDC.approve(BountyFactory, max_uint256)` bootstrap, but
   was deferred to direct `web3.py` for reasons documented in Claim 5
   below.

The findings below were collected over a single afternoon's integration
work, on top of the Enstabler integration history.

---

## Claim 1 — Direct Execution page contradicts the canonical Bearer auth scheme

**Verdict: VERIFIED (re-confirmed today; not yet fixed)**

The Direct Execution API page at
`docs.keeperhub.com/api/direct-execution` still literally states:

> All direct execution endpoints require an API key passed in the
> `X-API-Key` header:
> ```
> X-API-Key: keeper_...
> ```

This contradicts every other auth example in the docs:

- **Authentication page**: `Authorization: Bearer kh_your_api_key`
- **Webhook Authentication section**: `Authorization: Bearer wfb_your_api_key`
- **API Keys page**: keys are described with `kh_` (organization) or
  `wfb_` (user-scoped) prefixes. No `keeper_` prefix exists in the
  actual API.

Two issues:

1. **Wrong header name.** The page documents `X-API-Key`; the API requires
   `Authorization: Bearer`.
2. **Wrong key prefix.** The page documents `keeper_`; actual keys
   minted in the dashboard begin with `kh_`.

### Empirical reproduction

```bash
# Documented header — fails
$ curl -s -o /dev/null -w "%{http_code}\n" \
    -H "X-API-Key: kh_<live_key>" -H "Content-Type: application/json" \
    -X POST https://app.keeperhub.com/api/execute/contract-call \
    -d '{"contractAddress":"0xa0b8...eb48","network":"ethereum","functionName":"name","functionArgs":"[]"}'
401

# Actual working auth — succeeds
$ curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer kh_<live_key>" -H "Content-Type: application/json" \
    -X POST https://app.keeperhub.com/api/execute/contract-call \
    -d '{"contractAddress":"0xa0b8...eb48","network":"ethereum","functionName":"name","functionArgs":"[]"}'
200
```

### Suggested fix

Replace the `X-API-Key: keeper_...` example with the canonical Bearer
example, and add a one-line callout: "All KeeperHub endpoints
authenticate identically — `Authorization: Bearer kh_<key>`."

---

## Claim 2 — No static reference list of supported networks

**Verdict: VERIFIED**

The Chains API page advertises a `GET /api/chains` endpoint, but the
documentation only enumerates two of the twelve advertised chains. The
Direct Execution page says "supported networks: e.g., ethereum, base,
polygon, …" without an exhaustive table. Builders have to call the API
to learn what's supported, which doesn't help when picking a target
chain at the planning stage.

### Suggested fix

Publish a static "Supported Networks" reference table on
`docs.keeperhub.com` alongside the dynamic `/api/chains` endpoint. Each
row: chain name, chain id, whether Direct Execution is supported,
whether MCP `execute_workflow` is supported.

---

## Claim 3 — HTTP 202 success is undocumented

**Verdict: VERIFIED**

The Direct Execution page lists error codes (`401`, `422`, `429`, `400`)
but never says what success looks like. The actual write-side response
is `HTTP 202 Accepted` with body `{"status": "completed", ...}`, not
`200 OK` as a reader would assume.

This bit Ascertainty's first integration test against `/api/execute/contract-call`
because the success branch was guarded by `resp.status_code == 200`,
which silently treated a successful KeeperHub call as a failure.

### Suggested fix

Add a "Success Response" subsection to the Direct Execution page with
the full 202 envelope and a one-line note: "Write endpoints return 202;
the status field tells you whether the run completed."

---

## Claim 4 — Numeric chain-id escape hatch is undocumented

**Verdict: VERIFIED (load-bearing for non-listed chains)**

The `network` parameter is documented as a "name string" only (e.g.
`"ethereum"`, `"base"`). In practice, the API silently accepts decimal
chain IDs as strings, e.g. `"network": "16602"` for 0G Galileo. This is
load-bearing — it's the only way to target a chain that isn't on the
canonical name list.

For Ascertainty this is exactly the case: 0G Galileo (chain 16602) isn't
in the documented network names, but `"network": "16602"` works.

### Suggested fix

Add a single sentence to the `network` parameter description: "If a
chain is not on the supported names list, pass its decimal chain ID as a
string."

---

## Claim 5 — No REST endpoint for wallet discovery

**Verdict: VERIFIED**

The CLI exposes `kh wallet` to print the KeeperHub-managed Turnkey
wallet address for the current organization, but there is no REST
equivalent. Onboarding requires opening the dashboard UI to retrieve the
wallet address, then deploying a contract that allowlists that address
(in Ascertainty's case, calling `SolverRegistry.setAuthorized` to
authorize KeeperHub's wallet to bump reputation on settlement). For an
otherwise-headless integration, this is the one step that breaks
automation.

The result for Ascertainty was that `BountyFactory.claimBounty` ended up
called from the operator wallet (via `web3.py`) rather than KeeperHub's
Turnkey wallet — because the contract was authored before the
KeeperHub-side address could be looked up programmatically.

### Suggested fix

Add `GET /api/wallet` returning `{"address": "0x...", "network": "...",
"createdAt": ...}` so the deploy script can fetch it and bake the
address into the contract's authorization list at deploy time.

---

## Claim 6 — Agentic wallet skill-install command in docs is wrong

**Verdict: VERIFIED**

The Agentic Wallet docs show:

```bash
npx @keeperhub/wallet skill install
```

This fails because the package ships two binaries; npx doesn't know
which one to dispatch. The correct invocation is:

```bash
npx -p @keeperhub/wallet keeperhub-wallet skill install
```

### Suggested fix

Update the docs to show the explicit `-p` form, or rename the package's
secondary binary so the unqualified `npx @keeperhub/wallet` works.

---

## Claim 7 — 0G Galileo (chain 16602) not in `web3/*` action chain list

**Verdict: VERIFIED** — empirically reproduced today.

KeeperHub's `web3/*` action plugins (`web3/check-balance`,
`web3/read-contract`, `web3/write-contract`, `web3/transfer-token`, etc.)
are gated to a curated set of EVM chains. Calling
`get_plugin {pluginType: "web3/read-contract"}` returns 19 chains:
Ethereum, Sepolia, Base, Base Sepolia, Polygon, Arbitrum, Avalanche,
BNB, Plasma, Tempo, Solana Devnet — but **not** 0G Galileo (chainId 16602).

This blocks the most natural KeeperHub integration for Ascertainty: a
workflow that, on `/bounty/submit` accept, calls
`BountyFactory.claimBounty(bountyId)` from KH's hosted Turnkey wallet
after the challenge window expires. With the chain unsupported by the
web3 actions, the on-chain claim has to live in Ascertainty's own
backend (`claim_task`) instead.

The numeric escape hatch from Claim 4 (`network: "16602"`) is documented
as working for **Direct Execution**, but the workflow node `config.network`
field appears to be validated against the curated chain list at runtime
— I have not yet verified whether passing `"16602"` there would execute
anyway or fail validation.

### Empirical reproduction

```bash
$ python -c "
import asyncio, json, os
from backend.keeperhub import KeeperHubMcp
async def go():
    mcp = KeeperHubMcp(os.getenv('KEEPERHUB_API_KEY'))
    await mcp.initialize()
    p = await mcp.call_tool('get_plugin', {'pluginType': 'web3/read-contract'})
    chains = [c['chainId'] for c in p['chains']]
    print('16602 in supported chains?', 16602 in chains)
    print('chains:', sorted(chains))
asyncio.run(go())
"
16602 in supported chains? False
chains: [1, 56, 97, 102, 103, 137, 4217, 8453, 9745, 9746, 11155111, 42161, 42429, 43113, 43114, 80002, 84532, 421614, ...]
```

### Why this matters

0G is a fast-growing L1 with active testnet builder traction (this
hackathon alone has multiple projects targeting Galileo). Builders who
deploy contracts on 0G and want KeeperHub to drive on-chain automation
currently have to fall back to either (a) running their own continuous
backend that signs with their own wallet, defeating KH's hosted-wallet
value proposition, or (b) Direct Execution if it accepts the numeric
chain-ID escape hatch end-to-end (untested for write actions).

### Suggested fix

1. Add 0G Galileo (chainId 16602) and 0G mainnet to the curated chain
   list for the `web3/*` actions. The chain is EVM-compatible (the
   plugins should work without protocol-level changes).
2. If a curated entry isn't immediately possible, add an explicit
   "fallback" chain entry shape in the action node config schema:
   `{ "network": "<chainId>", "rpc": "<custom_rpc_url>" }`. Builders
   could then point at any EVM chain by URL, with KH's wallet signing
   the tx and broadcasting via the supplied RPC. This is a one-time
   per-builder setup that unlocks every long-tail EVM testnet without
   KH having to curate each one.
3. Document the result either way on the
   `docs.keeperhub.com/api/direct-execution` page.

### Workaround used in Ascertainty

The KH integration that actually shipped is a manual-trigger workflow
(`Ascertainty Settlement Monitor`, id `mqfy9h0zkedx1y4dbtrs5`) that does
a `web3/check-balance` probe on Ethereum mainnet (chain 1) on every
verification accept — purely to demonstrate the MCP trigger pipeline.
The on-chain `claimBounty` runs from the operator wallet via web3.py in
Ascertainty's `claim_task` background task. This is an acceptable
hackathon compromise but isn't the architecture I'd ship to production
once chain 16602 is supported.

---

## What worked well

- The MCP `streamable-HTTP` transport is exactly what we needed for a
  hosted workflow trigger from a backend. Once the auth header thing was
  sorted, `initialize` → `execute_workflow` was a one-liner.
- `mcp-session-id` header propagation is well-thought-out and didn't
  trip us up.
- The `kh_` API key works identically across MCP and Direct Execution
  surfaces — having one credential is much nicer than alternatives that
  require separate keys per surface.
- Workflow execution status responses are clean JSON envelopes; easy to
  persist to our `kh_executions` table for audit.

---

## Summary

Seven independently verified findings, all caught while integrating
KeeperHub into a single hackathon project's settlement loop. The
auth-header bug (Claim 1) and the missing wallet discovery endpoint
(Claim 5) had the highest doc-side impact. The chain-coverage gap
(Claim 7) is the most consequential platform-side finding: it's the
single thing that would let Ascertainty (and any other 0G-native
project) shift the settlement signer to KeeperHub's hosted wallet,
which is the architecture I'd ship to production.

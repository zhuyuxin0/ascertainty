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
equivalent. For an otherwise-headless integration, this is the one
step that breaks automation: the operator has to open the dashboard
UI, copy the address, paste it into `.env` as
`KEEPERHUB_WALLET_ADDRESS`, and fund it with gas — none of which can
be scripted. For Ascertainty this matters specifically for the
"Settlement Authority" UI: the dashboard shows the KH wallet address
on every bounty page (linked to the Galileo block explorer) so the
poster can independently audit who will move their USDC at settlement
time. With no REST endpoint, populating that field at deploy time
remains a manual step.

It also matters for any contract that wants to allowlist KH's wallet
at construction (e.g., a hypothetical `keeperFee` flow that pays the
settler a tiny share of the bounty would need the KH address baked in
at deploy). Not on Ascertainty's critical path because `settleBounty`
is permissionless, but it would be on most production keeper integrations.

### Suggested fix

Add `GET /api/wallet` returning `{"address": "0x...", "network": "...",
"createdAt": ...}` so the deploy script can fetch it and bake the
address into the contract's authorization list (or the dashboard's
"Settlement Authority" UI) at deploy time.

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

## Claim 7 — `create_workflow` schema is largely tribal knowledge

**Verdict: VERIFIED** — caught while wiring the new `settleBounty`
architecture against KH's MCP `create_workflow` tool today (May 3,
2026), after the Week 17 0G chain support landed.

The `create_workflow` MCP tool's `inputSchema` advertises only
`name`, `nodes`, `edges` (required) plus `description`, `enabled`,
`projectId`, `tagId`. The shape inside `nodes` and `edges` is
typed as a permissive `array<object>` with no further structure —
so a correct workflow can only be built by either (a) reading an
existing workflow's JSON via `get_workflow` and copying, or (b)
asking `ai_generate_workflow` and reverse-engineering its output.

Even after that path, four distinct behaviors bit our integration
in sequence (each one a separate failed execution):

1. **`network` parameter format.** `ai_generate_workflow` emits
   `"network": "chain-16602"`. The actual web3 plugin requires
   the bare numeric chain-ID string `"16602"` (or one of the named
   aliases like `"ethereum"`). Error: `Unsupported network:
   chain-16602`.

2. **`functionArgs` shape is undocumented.** The plugin returns an
   error message that says "Function arguments must be a JSON
   array" only when you pass an object. With a JSON array of
   positional values it works; with an object keyed by argument
   name it fails. Neither shape is in `get_plugin web3/write-contract`'s
   schema documentation.

3. **`functionArgs` is template-substituted, then JSON-parsed.**
   So `"functionArgs": "{\"bountyId\": {{@trigger-1.field}}}"` fails
   with `Expected property name or '}' in JSON at position N` —
   because the template's `{{` is preserved through the JSON
   parse when substitution can't find the field. The error
   position is in the un-substituted source, not the resolved
   string, which made the failure mode genuinely hard to read.

4. **Manual-trigger inputs are surfaced FLAT on the trigger node's
   output, not under `inputs`/`input`/`body`/`payload`/`data`.** The
   working template was `{{@trigger-1:Manual Trigger.bountyId}}` —
   not `{{@trigger-1:Manual Trigger.input.bountyId}}` (which
   silently substitutes to undefined → empty → "argument missing").
   This isn't documented in the plugin's `templateSyntax` examples
   (which only show webhook `body.amount` and a previous node's
   named output `balance`).

### Suggested fix

1. Document the canonical web3-action node config shape on the
   web3 plugin docs page — at minimum the four fields
   (`actionType`, `network`, `contractAddress`, `abi`,
   `abiFunction`, `functionArgs`, `gasLimitMultiplier`), with a
   worked example for a uint256 arg from a manual trigger.
2. Document the `functionArgs` envelope: positional JSON array,
   substituted before parse.
3. Add a `Manual Trigger` example to `templateSyntax.examples`
   showing the flat field access pattern.
4. Make `ai_generate_workflow` emit the correct `network` format
   (it currently produces output that fails validation against
   the very plugin it's targeting).

### What worked

The `update_workflow` tool correctly accepts a full nodes/edges
replace, so once the right shape was found, fixing the workflow
in place across iterations was clean. `get_execution_status`'s
`errorContext.error` field is a great surface for diagnosing
node-level failures — the messages are specific (e.g.,
`Contract call failed: Error(not settleable)` came back with the
exact Solidity revert reason, which is the right signal for an
on-chain integration). Once the workflow was correctly defined,
the KH Turnkey wallet on chain 16602 signed and broadcast the
on-chain `settleBounty` reliably; the integration is solid once
past the schema-discovery cliff.

---

## Claim 8 — MCP `execute_workflow` arg name is `input`, not `inputs`

**Verdict: VERIFIED**

A small but high-cost paper cut: the MCP `execute_workflow` tool's
inputSchema names the parameter `input` (singular). Most builders
will reach for `inputs` (plural) by analogy with REST APIs, the
KeeperHub UI's "Inputs" section, and the workflow definition's
own `inputSchema` field — which is also plural-shaped (mapping
input names to schemas).

When you call `execute_workflow` with `inputs: { bountyId: 1 }`,
KH happily accepts the call (the extra field is silently ignored)
and runs the workflow with no input data, so the failure surfaces
downstream as a template-substitution miss, not as an arg validation
error.

### Suggested fix

Either (a) accept both `input` and `inputs` for ergonomics, or
(b) reject unknown top-level args from `execute_workflow` so the
typo surfaces immediately instead of cascading into a confusing
template-substitution failure 60 seconds later.

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

Eight independently verified findings, all caught while integrating
KeeperHub into a single hackathon project's settlement loop — six
during the initial integration on April 27, plus two more (Claims 7
and 8) discovered today (May 3) while wiring the production
settlement architecture against the new 0G chain support. The
auth-header bug (Claim 1) and the missing wallet discovery endpoint
(Claim 5) had the highest doc-side impact; Claim 7's
`create_workflow` schema gaps had the highest engineering-time
impact (≈40 minutes of binary-searching error messages to find
that `network` wants `"16602"` not `"chain-16602"`, `functionArgs`
wants a positional array, and template substitution surfaces
trigger inputs flat).

### Resolved during the hackathon

A previous draft of this report included a seventh claim — 0G Galileo
(chain 16602) was missing from the curated chain list for `web3/*`
action plugins, which blocked the natural settlement architecture of
having KeeperHub's hosted Turnkey wallet drive `claimBounty` on 0G.
This was resolved when KeeperHub announced official 0G chain support
in the Week 17 update on May 2, 2026.

In response Ascertainty shipped the production architecture the
original report recommended:

1. Added `BountyFactory.settleBounty(uint256)` — permissionless on
   chain, USDC always flows to the recorded solver (never to
   `msg.sender`), so settlement infra is fully decoupled from solver
   custody. The new factory is at
   `0x2B1cBdC4FBF77Ca66483F840E7D9C626b7D1563f`, the matching
   SolverRegistry at `0xe834d3fDACa5D9091D3c32F74c968e9469Ae513A`,
   both authored together so the current operator wallet owns the
   registry and can authorize the new factory in one flow.
2. Replaced the per-persona `claim_task` background loop with
   `settle_task`, which on every poll triggers the KH workflow via
   MCP `execute_workflow` (preferred path) and falls back to the
   operator wallet on KH unreachability — the on-chain function is
   idempotent so duplicate calls revert cheaply with "not settleable".
3. Created a one-shot installer at
   `scripts/setup_keeperhub_workflow.py` that uses MCP
   `create_workflow` to register the "Ascertainty Settlement Driver"
   workflow with a single `web3/write-contract` step targeting
   chain 16602 — programmatic, idempotent, no dashboard clicks.

So the chain-coverage gap no longer constrains the architecture, and
the workaround documented in the original draft (an Ethereum-mainnet
balance probe as a stand-in trigger) has been retired. KeeperHub is
now the on-chain Settlement Authority, surfaced as a live card on
the dashboard's `/agent` and `/bounty/<id>` pages.

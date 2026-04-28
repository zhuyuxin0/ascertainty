# Ascertainty

**Where proofs pay.**

A universal verification oracle: formal proofs (Lean4) and engineering
predictions are verified deterministically, settled in demo USDC on
**0G Galileo (testnet, chainId 16602)**, and visualized as real-time 3D
racing.

> ETHGlobal Open Agents 2026. Solo build by [@zhuyuxin0](https://github.com/zhuyuxin0).
> Live demo: **[ascertainty.xyz](https://ascertainty.xyz)** · API: **[api.ascertainty.xyz](https://api.ascertainty.xyz/health)**
> Settlement is **on-chain on 0G Galileo testnet** with `MockUSDC` (a
> permissionless 6-decimal ERC-20); no canonical bridged USDC exists on
> Galileo at submission time.

---

## What it does

Verifiable claims become bountied. Solvers race to produce accepted
proofs. Settlement is autonomous and on-chain.

- **Poster** publishes a YAML bounty spec (`theorem_signature`,
  `mathlib_sha`, `lean_toolchain`, `axiom_whitelist`, `bounty_usdc`,
  `deadline_unix`, `challenge_window_seconds`) and escrows MockUSDC into
  [BountyFactory.sol](contracts/src/BountyFactory.sol) on 0G Galileo.
- **Solver** submits a Lean4 proof; the verifier spawns the real
  `lean v4.10.0` binary against the Lean stdlib, parses exit code +
  `#print axioms` output, and returns accept/reject. `verifier_mode`
  (`real_lean4` / `mock_lean4`) is recorded in every attestation. The
  mock fallback only triggers in environments without the toolchain
  installed (e.g. local dev).
- On accept, the agent signs the attestation (EIP-191), uploads it to
  **0G Storage**, fetches a TEE-verified explanation from **0G
  Compute** (Sealed Inference, OpenAI-compatible client), and posts
  `submitProofFor(bountyId, attestationHash, solver, signature)` —
  the operator pays gas; the on-chain `solver` is recovered from the
  EIP-191 signature via OZ ECDSA so it can differ from the relayer.
  When called without a signature, the legacy `submitProof` path makes
  the relayer the on-chain solver (used by the auto-seeded demo races).
- After the configurable challenge window, the auto-claim task fires
  `claimBounty` and the MockUSDC settles to the solver wallet. Solver
  reputation increments in [SolverRegistry.sol](contracts/src/SolverRegistry.sol).
- Each accepted submission also triggers a configured **KeeperHub MCP
  workflow** via `execute_workflow` (real JSON-RPC POST to
  `app.keeperhub.com/mcp`); execution receipts persist in the
  `kh_executions` table and surface on the agent panel.
- The agent owns **ERC-7857-inspired iNFTs**
  ([AgentNFT.sol](contracts/src/AgentNFT.sol)); each token's Merkle-root
  pointer references an identity blob on 0G Storage.
- Every state transition emits an on-chain event; the watcher polls
  `BountyCreated` / `ProofSubmitted` / `ProofChallenged` /
  `BountyClaimed` every 5 s and synthesises per-solver race events that
  drive the dashboard's Three.js + R3F race scene. (The 5 s gap is
  safe: `BountyFactory` flips `Status.Open → Submitted` atomically, so
  any racing second submitter reverts on-chain with `not open`.)

## Three-layer demo

1. **Verification primitive** — `python -m cli.ascertainty verify --spec
   specs/examples/sort_correctness.yaml --proof path.lean` returns a
   signed JSON attestation. `python -m cli.ascertainty submit-relayed`
   shows the gasless solver-relayer flow end-to-end with an ephemeral
   solver keypair.
2. **Settlement** — escrow + submit + claim entirely on-chain on 0G
   Galileo testnet (chainId 16602). The `submitProofFor` path lets a
   real solver sign off-chain while the operator pays gas; the seeded
   demo races use the simpler `submitProof` path.
3. **Racing visualization** — each bounty's track is procedurally
   shaped from the spec's `axiom_whitelist` breadth, theorem
   complexity, and `mathlib_sha` seed; each solver is a car driven by
   the race event stream. (True Lean4 dependency-graph extraction from
   proof terms is the natural Phase 2.)

## Live URLs

| Surface | URL |
|---|---|
| Dashboard (apex) | https://ascertainty.xyz |
| Bounties list | https://ascertainty.xyz/bounties |
| Create bounty form | https://ascertainty.xyz/bounties/new |
| Race viewer (template: `/race/<id>`) | https://ascertainty.xyz/race/1 |
| Leaderboard | https://ascertainty.xyz/leaderboard |
| **Agent status (all 4 0G pillars + KH)** | https://ascertainty.xyz/agent |
| Backend API | https://api.ascertainty.xyz |
| Backend health | https://api.ascertainty.xyz/health |

## Deployed contracts (0G Galileo, chain 16602)

See [`backend/contract_addresses.json`](backend/contract_addresses.json).

| Contract | Address |
|---|---|
| MockUSDC | `0x8D53B5b599caA7205fB869A14Dd7141c3866010a` |
| SolverRegistry | `0x6E5CEb3Ac85dA96479A0C080E7fB8D5762551A32` |
| BountyFactory | `0x11E351EA4Ec6F9163916c1941320a0F6d2b80C1c` |
| AgentNFT | `0x0cf5c9dd2CF3E48b2E1078995289d6b0690f1105` |

Block explorer: https://chainscan-galileo.0g.ai

## Prize-track integrations

### 0G ($15,000) — all four pillars in production

| Pillar | Evidence |
|---|---|
| **0G Chain** | Four contracts deployed (above). Settlement loop end-to-end. |
| **0G Storage** | Per-attestation blobs uploaded via `python-0g` SDK; per-persona agent identity blobs referenced by the iNFTs. |
| **0G Compute** | TEE-verified explanations via Sealed Inference (`a0g.get_openai_async_client()`). Required for live demo bounties; production retains a graceful fallback path so a transient endpoint outage never blocks settlement. |
| **0G iNFT (ERC-7857-inspired)** | Multiple persona iNFTs minted by the operator wallet, each with a distinct identity blob root on 0G Storage; metadata + cards visible at [/agent](https://ascertainty.xyz/agent). |

### KeeperHub ($4,500) — both integration surfaces

- **MCP workflow trigger** — every `/bounty/submit` accept fires
  `execute_workflow` on workflow `mqfy9h0zkedx1y4dbtrs5` ("Ascertainty
  Settlement Monitor"), created programmatically via the MCP
  `create_workflow` tool. Executions logged to `kh_executions` table,
  surfaced on `/agent`.
- **Documentation feedback** — see [FEEDBACK.md](FEEDBACK.md): seven
  verified findings including the missing wallet-discovery REST
  endpoint and the 0G-Galileo chain-coverage gap that blocked moving
  the on-chain claim signer to KeeperHub's hosted wallet.

## Architecture

```
                  ┌──────────────────────┐         ┌────────────────────┐
   poster  ────▶  │  POST /bounty/create │────▶    │  BountyFactory     │
                  │  (FastAPI)           │         │  .createBounty(…)  │
                  └──────────┬───────────┘         └─────────┬──────────┘
                             │                               │ event
                             ▼                               ▼
                  ┌──────────────────────┐         ┌────────────────────┐
   solver  ────▶  │  POST /bounty/submit │────▶    │  watcher (polls)   │
                  │  ① real Lean4 verify │         │  emits race_events │
                  │  ② sign attestation  │         └─────────┬──────────┘
                  │  ③ upload to 0G Stor │                   │
                  │  ④ submitProofFor    │                   ▼
                  │     (operator pays   │         ┌────────────────────┐
                  │      gas, ecrecover  │         │  Next.js dashboard │
                  │      restores solver)│         │  Three.js race viz │
                  │  ⑤ KH execute_wf     │         └────────────────────┘
                  └──────────────────────┘
                  ┌──────────────────────┐
   claim_task ──▶ │  BountyFactory       │  after (challenge_window_s)
   (every 30s)    │  .claimBounty(id)    │  → BountyClaimed → finish event
                  └──────────────────────┘
```

Background tasks running on the production backend: `watcher`
(polling on-chain BountyFactory events every 5s; safe race window —
the contract enforces atomic `Status.Open → Submitted` transition),
`claim_task` (auto-claim after challenge window every 30s),
`cctp_watcher` (Alchemy WS for mainnet stablecoin flow analytics, not
contract events), `telegram_bot` (long-poll for `/bounties`,
`/status`, `/race` commands), `inft.init` (idempotent mint of the
agent persona iNFTs on first boot).

## Local dev

```bash
# 1. Backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
cp .env.example .env             # populate OG_PRIVATE_KEY + KEEPERHUB_* + ALCHEMY_* + TELEGRAM_*
venv/bin/uvicorn backend.main:app --port 8000

# 2. Dashboard
cd dashboard
npm install --legacy-peer-deps
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev

# 3. One-time on-chain setup (mints MockUSDC + approves BountyFactory)
venv/bin/python -m cli.ascertainty bootstrap

# 4. Optional — seed mock race events for the visualizer
venv/bin/python -m cli.ascertainty seed-race 1
```

## Deploy

- **Frontend** — Vercel project at `dashboard/`, auto-deploys on every
  push to `main`. Set `NEXT_PUBLIC_API_URL` per environment.
- **Backend** — single command: `./scripts/deploy-contabo.sh <ssh-alias>`
  (any Docker + nginx VPS — the script is host-agnostic). Runs Docker
  build + nginx server-block install + Let's Encrypt cert renewal.

## Repo layout

```
ascertainty/
├── backend/              FastAPI app + lifespan tasks (watcher / claim / inft / cctp / telegram)
│   ├── main.py
│   ├── bounty_manager.py + db.py
│   ├── verifier.py + spec.py + attestation.py
│   ├── og_chain.py + og_storage.py + og_compute.py + inft.py
│   ├── publisher.py + watcher.py + claim_task.py
│   ├── keeperhub.py + telegram_bot.py + cctp_watcher.py
│   └── flow_classifier.py + entity_labels.json     ← Enstabler port
├── cli/
│   └── ascertainty.py    `verify`, `bootstrap`, `seed-race`, `submit-relayed` subcommands
├── contracts/            Hardhat + Solidity 0.8.24 + OpenZeppelin
│   └── src/{BountyFactory,SolverRegistry,AgentNFT,MockUSDC}.sol
├── specs/examples/       4 hand-crafted bounty YAMLs (sort, erc20, heat, mathlib)
├── dashboard/            Next.js 14 (App Router) + R3F + cannon-es
│   ├── app/{,bounties/,bounties/new/,leaderboard/,race/[bountyId]/,agent/}/page.tsx
│   ├── components/       Race + Track + RaceCar + CameraRig + PostFX + …
│   └── public/models/cars/   Kenney Car Kit (CC0)
├── Dockerfile + docker-compose.yml + Caddyfile (deprecated, see Caddyfile note)
├── scripts/
│   ├── deploy-contabo.sh
│   └── nginx-ascertainty.conf
├── FEEDBACK.md           KeeperHub doc & platform feedback (7 verified findings)
└── README.md (this file)
```

## Open-source attributions

See [`dashboard/lib/ATTRIBUTIONS.md`](dashboard/lib/ATTRIBUTIONS.md).
Notably: pmndrs/racing-game (MIT), Bruno Simon's folio-2019 (MIT)
floor + shadow shaders, Kenney Car Kit (CC0), PolyHaven Rooftop
Night HDRI (CC0), Anderson Mancini's lens flare (CC0).

## Known limitations (would fix in production)

- **Demo USDC, not bridged Circle USDC.** `MockUSDC` is a permissionless
  6-decimal ERC-20 deployed by the operator. No canonical bridged USDC
  exists on 0G Galileo at submission time. Production would swap to a
  bridged Circle USDC once 0G mainnet + a CCTP corridor land.
- **Real Lean4 kernel runs against the Lean stdlib only — Mathlib not
  yet pre-built per `mathlib_sha`.** The agent spawns `lean v4.10.0`
  per submission via `backend/lean_runner.py` with a 30s timeout,
  parses exit code + `#print axioms`, and records
  `verifier_mode: real_lean4`. Mathlib-based verification (one
  toolchain build per pinned `mathlib_sha`) is the natural Phase 2 —
  adds 10–20 min one-time provisioning per spec, then ~5s per proof.
  When the toolchain isn't installed (e.g. local dev), the verifier
  transparently falls back to a mock with a sentinel comment, tagged
  `verifier_mode: mock_lean4`.
- **Track shape derived from spec metadata, not from real Lean4 proof
  DAG.** Today's `graphFromSpec` maps `axiom_whitelist.length →
  branchFactor`, theorem complexity → depth, `mathlib_sha` first 4
  bytes → seed. True dependency-graph extraction from Lean4 proof
  terms would land in Phase 2 alongside the Mathlib provisioning.
- **0G Galileo not yet on KeeperHub's web3 chain list.** Forces the
  on-chain settlement signer to remain the operator wallet rather than
  KH's hosted Turnkey wallet (FEEDBACK.md Claim 7).

# Ascertainty

**Where proofs pay.**

A universal verification oracle: formal proofs (Lean4) and engineering
predictions are verified deterministically, settled in USDC on **0G Chain**,
and visualized as real-time 3D racing.

> ETHGlobal Open Agents 2026. Solo build by [@zhuyuxin0](https://github.com/zhuyuxin0).
> Live demo: **[ascertainty.xyz](https://ascertainty.xyz)** · API: **[api.ascertainty.xyz](https://api.ascertainty.xyz/health)**

---

## What it does

Verifiable claims become bountied. Solvers race to produce accepted
proofs. Settlement is autonomous and on-chain.

- **Poster** publishes a YAML bounty spec (`theorem_signature`,
  `mathlib_sha`, `lean_toolchain`, `axiom_whitelist`, `bounty_usdc`,
  `deadline_unix`, `challenge_window_seconds`) and escrows USDC into
  [BountyFactory.sol](contracts/src/BountyFactory.sol) on 0G Galileo.
- **Solver** submits a Lean4 proof; Ascertainty's verifier (mock kernel
  for the hackathon) returns accept/reject.
- On accept, the agent signs an attestation, uploads it to **0G
  Storage**, fetches a TEE-verified explanation from **0G Compute**, and
  posts `submitProof(bountyId, attestationHash)` on-chain.
- After the configurable challenge window, the auto-claim task fires
  `claimBounty` and the USDC settles to the solver wallet. Solver
  reputation increments in [SolverRegistry.sol](contracts/src/SolverRegistry.sol).
- Each accepted submission also triggers a configured **KeeperHub MCP
  workflow** via `execute_workflow`, recorded in the agent's status
  panel.
- The agent owns an **ERC-7857 iNFT** ([AgentNFT.sol](contracts/src/AgentNFT.sol))
  whose Merkle-root pointer references its identity blob on 0G Storage.
- Every state transition emits an on-chain event; the watcher synthesises
  per-solver race events that drive the dashboard's Three.js + R3F race
  scene.

## Three-layer demo

1. **Verification primitive** — `python -m cli.ascertainty verify --spec
   specs/examples/sort_correctness.yaml --proof path.lean` returns a
   signed JSON attestation.
2. **Settlement** — escrow + submit + claim entirely on-chain on 0G
   Galileo (chain 16602). Operator-as-solver demo flow; production would
   use solver-side wallets.
3. **Racing visualization** — each bounty is a procedurally-generated
   track derived from the proof's dependency graph; each solver is a
   car driven by the race event stream.

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
| BountyFactory | `0xA770aa3aDAA21895a94a0650976A0345839505e1` |
| AgentNFT | `0x0cf5c9dd2CF3E48b2E1078995289d6b0690f1105` |

Block explorer: https://chainscan-galileo.0g.ai

## Prize-track integrations

### 0G ($15,000) — all four pillars in production

| Pillar | Evidence |
|---|---|
| **0G Chain** | Four contracts deployed (above). Settlement loop end-to-end. |
| **0G Storage** | Per-attestation blobs uploaded via `python-0g` SDK; agent identity blob at root `0xcfb1021b…` referenced by the iNFT. |
| **0G Compute** | TEE-verified explanations via `a0g.get_openai_async_client()`. Best-effort with graceful degradation. |
| **0G iNFT (ERC-7857)** | Token #1 minted by operator wallet; metadata visible at [/agent](https://ascertainty.xyz/agent). |

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
                  │  ① mock Lean4 verify │         │  emits race_events │
                  │  ② sign attestation  │         └─────────┬──────────┘
                  │  ③ upload to 0G Stor │                   │
                  │  ④ submit on-chain   │                   ▼
                  │  ⑤ KH execute_wf     │         ┌────────────────────┐
                  └──────────────────────┘         │  Next.js dashboard │
                                                   │  Three.js race viz │
                  ┌──────────────────────┐         └────────────────────┘
   claim_task ──▶ │  BountyFactory       │  after (challenge_window_s)
   (every 30s)    │  .claimBounty(id)    │  → BountyClaimed → finish event
                  └──────────────────────┘
```

Background tasks running on the production backend: `watcher`
(polling on-chain BountyFactory events every 5s), `claim_task`
(auto-claim after challenge window every 30s), `cctp_watcher` (Alchemy
WS for cross-chain USDC into/out of escrow), `telegram_bot` (long-poll
for `/bounties`, `/status`, `/race` commands), `inft.init` (one-shot
mint of agent iNFT on first boot).

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
- **Backend** — single command: `./scripts/deploy-contabo.sh <your-ssh-alias>`.
  Runs Docker build + nginx config + Let's Encrypt cert renewal on the
  Contabo VPS.

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
│   └── ascertainty.py    `verify`, `bootstrap`, `seed-race` subcommands
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

- **Operator-as-solver demo flow.** `BountyFactory.submitProof` makes
  the caller the solver; with no frontend wallet-connect for the
  hackathon, the operator wallet plays both poster and solver roles
  and USDC round-trips through the escrow. A production rewrite would
  add `submitProofFor(bountyId, attestationHash, solver, signature)`
  with on-chain ecrecover so the agent can submit on a solver's
  behalf.
- **Mock Lean4 kernel.** Real Lean verification (spawning `lake env
  lean --run check.lean` against a pinned mathlib SHA) is the natural
  follow-up. The attestation schema and signing already match a real
  kernel's output shape.
- **0G Galileo not yet on KeeperHub's web3 chain list.** Forces the
  on-chain settlement signer to remain the operator wallet rather than
  KH's hosted Turnkey wallet (FEEDBACK.md Claim 7).
- **Visual polish ceiling.** The R3F + Bruno-floor + Kenney-cars stack
  is solid but won't match a hand-modeled production game. Day 3-4 of
  the visual reskin (dual-curve cinematic camera, FOV pulse, custom
  GLB track segments) would close the remaining gap.

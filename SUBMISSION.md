# ETHGlobal Open Agents 2026 — Submission Material

This file contains copy-paste-ready text for the ETHGlobal submission
form plus a demo-video shot list. Not for the repo — for you, the
solo builder, to shovel into the form on submission day.

---

## Project name
```
Ascertainty
```

## Short description (≤140 chars)
```
A universal verification oracle: formal proofs settled in USDC on 0G Chain, visualized as real-time 3D racing.
```

## Tagline
```
Where proofs pay.
```

## Long description (the "What does it do?" field)

```
Ascertainty turns verifiable claims into bountied races. A poster
escrows USDC against a YAML bounty spec (theorem, mathlib SHA, lean
toolchain, axiom whitelist, deadline, challenge window). Solvers
submit Lean4 proofs; an autonomous agent runs the verifier kernel,
signs an attestation, uploads it to 0G Storage, fetches a TEE-verified
explanation from 0G Compute, and posts the result on-chain to a
BountyFactory contract on 0G Galileo. After a configurable challenge
window, the auto-claim task fires claimBounty and the USDC settles
to the solver, with reputation logged in a SolverRegistry. The agent
itself owns an ERC-7857 iNFT whose Merkle-root pointer references
its identity blob on 0G Storage.

Each bounty also generates a procedurally-shaped racetrack derived
from the proof's dependency graph, and each solver becomes a car.
Real on-chain events (BountyCreated, ProofSubmitted, BountyClaimed)
are picked up by the watcher and emitted as race events, so the
3D dashboard plays back the actual settlement activity in real time.

Built solo for ETHGlobal Open Agents 2026 in seven days.
```

## How it's made (technical "How did you build this?" field)

```
Stack:
  Backend  — Python 3.12 + FastAPI + SQLite (WAL); web3.py for 0G
             Galileo; python-0g (a0g) SDK for 0G Storage + 0G Compute;
             eth-account for attestation signing.
  Contracts — Solidity 0.8.24 + OpenZeppelin via Hardhat. Deployed to
             0G Galileo (chain 16602): BountyFactory, SolverRegistry,
             AgentNFT (ERC-7857-inspired iNFT), MockUSDC.
  Dashboard — Next.js 14 (App Router) + Tailwind, with Three.js +
             @react-three/fiber + @react-three/cannon for the 3D race
             scene, Bruno Simon's folio-2019 floor + shadow shaders
             ported on top, Kenney Car Kit (CC0) low-poly chassis,
             PolyHaven Rooftop Night HDRI for IBL, and Anderson
             Mancini's R3F lens flare.
  Settlement — single watcher polling BountyFactory events on 0G
             Galileo every 5s; a separate claim_task posts claimBounty
             after each submitted bounty's challenge window expires.
             KeeperHub MCP fires execute_workflow on every accept,
             logged to a kh_executions table and surfaced on /agent.
  iNFT       — operator wallet's identity blob (deployed contract
             addresses, supported spec families, verifier descriptor)
             uploaded to 0G Storage on first boot; the resulting
             Merkle root anchors AgentNFT.mint(). Idempotent across
             restarts.
  Demo       — hosted on Contabo (FastAPI behind nginx + Let's Encrypt
             via certbot --nginx) and Vercel (Next.js dashboard, custom
             domain ascertainty.xyz). Single-command redeploy via
             scripts/deploy-contabo.sh.

Key engineering decisions:
  - Operator-as-solver demo flow. The deployed BountyFactory makes
    msg.sender the solver in submitProof, so with no MetaMask wallet
    flow shipped, the operator wallet plays both roles and USDC
    round-trips through escrow. A production rewrite would add
    submitProofFor(bountyId, attestationHash, solver, signature) with
    on-chain ecrecover.
  - Real Lean 4 kernel (v4.10.0) installed in the Docker image via
    elan. backend/lean_runner.py spawns `lean` against a temp file
    per submission, parses the real exit code + #print axioms output,
    times out at 30s. Tested in production: trivial proofs accept
    (zero axioms), wrong proofs reject with the actual Lean type-error
    message in kernel_output. Each attestation carries
    verifier_mode: real_lean4 vs mock_lean4 so it's transparent when
    the fallback fired (e.g. local dev without elan).
    Phase 1 scope: stdlib-only. Mathlib-pinned verification per
    spec.mathlib_sha is Phase 2 (one toolchain build per SHA).
  - Race events are time-gated server-side. seed-race CLI inserts
    rows with future timestamps; the /bounty/{id}/race-events endpoint
    only returns events with ts <= now, so a 90-second seeded race
    actually plays out over 90 seconds in the dashboard rather than
    fast-forwarding on first poll.

Open-source acknowledgments (full text in dashboard/lib/ATTRIBUTIONS.md):
  - pmndrs/racing-game (MIT) — RaycastVehicle pattern reference
  - brunosimon/folio-2019 (MIT) — fullscreen 4-corner gradient
    backdrop shader and per-object fake shadow technique
  - Kenney Car Kit (CC0) — low-poly car GLBs
  - PolyHaven Rooftop Night HDRI (CC0) — IBL for car body reflections
  - ektogamat/R3F-Ultimate-Lens-Flare (CC0) — postprocessing effect
```

## Prize-track justifications (paste into respective fields)

### 0G ($15,000)

```
All four 0G pillars in production:

1. 0G Chain (Galileo, chainId 16602):
   BountyFactory, SolverRegistry, AgentNFT, MockUSDC deployed.
   Settlement loop (createBounty → submitProof → claimBounty)
   verified end-to-end with real txs visible in the agent panel.

2. 0G Storage:
   Every accepted attestation is uploaded as canonical JSON via
   the python-0g SDK; the returned Merkle root is anchored
   on-chain via BountyFactory.submitProof(attestationHash bytes32).
   The agent's own identity blob lives at root
   0xcfb1021b2614b7aa312d8807a61b2d842833f7546c2b9c0bbc666569ffb439bb.

3. 0G Compute:
   TEE-verified natural-language explanations of each verification
   are fetched via the SDK's OpenAI-compatible client (auto-discovers
   a chat service from a.get_all_services()). Best-effort with
   graceful degradation when the provider isn't funded.

4. 0G iNFT (ERC-7857):
   AgentNFT contract mints one token per agent wallet on startup.
   Token #1 owned by the operator, with on-chain bytes32 pointer
   to the storage root above. Visible at /agent. The contract
   matches the ERC-7857 shape (storageRootHash + modelDescriptor +
   versionTag in metadata).

Architecture: backend/og_chain.py wires web3 to Galileo,
backend/og_storage.py + backend/og_compute.py wrap python-0g,
backend/inft.py runs the one-shot mint flow on lifespan startup.
contracts/src/AgentNFT.sol is the ERC-7857-inspired iNFT.
```

### KeeperHub ($4,500)

```
Two integration surfaces shipped:

1. MCP execute_workflow trigger on verification accept:
   The /bounty/submit endpoint, after building the attestation,
   calls keeperhub.execute_oneoff(KEEPERHUB_WORKFLOW_ID, inputs)
   via the MCP JSON-RPC 2.0 protocol with the documented
   `Authorization: Bearer kh_<key>` header. Each execution is
   recorded in the kh_executions table and surfaced on the agent
   status page (/agent). The workflow itself was created
   programmatically via MCP create_workflow + ai_generate_workflow,
   not the dashboard UI.

2. Documentation feedback (FEEDBACK.md):
   Seven verified findings from a single afternoon's integration
   work, including:
   - Direct Execution page documents X-API-Key but the API
     requires Authorization: Bearer (and keeper_ vs kh_ prefix).
   - HTTP 202 success undocumented.
   - No REST endpoint for wallet discovery — forced the
     architectural compromise of using the operator wallet as
     settlement signer rather than KH's hosted Turnkey wallet.
   - 0G Galileo (chain 16602) not in the curated chain list for
     web3/* actions, blocking the natural settlement integration.
   - Numeric chain-ID escape hatch is undocumented.
   - Agentic wallet skill-install command in docs is wrong.

Architecture: backend/keeperhub.py is a minimal MCP client; the
workflow JSON was constructed via the MCP API and stored in the
KH dashboard (id mqfy9h0zkedx1y4dbtrs5).
```

### (If picking) Gensyn or Uniswap

```
Not used. The Gensyn / Uniswap prize tracks weren't a natural fit
for the verification-oracle thesis; we focused implementation
budget on the 0G + KeeperHub tracks where every required surface
shipped end-to-end.
```

## Links to paste in submission form

| Field | Value |
|---|---|
| Project URL / live demo | https://ascertainty.xyz |
| GitHub repo | https://github.com/zhuyuxin0/ascertainty |
| Backend health (proof of liveness) | https://api.ascertainty.xyz/health |
| Agent status (prize-track proof) | https://ascertainty.xyz/agent |
| 0G Galileo block explorer | https://chainscan-galileo.0g.ai/address/0xA770aa3aDAA21895a94a0650976A0345839505e1 |

## Demo video shot list (≤3 minutes)

A tight script you can read aloud while screen-recording. Aim for
~2:30 — leaves headroom and respects the 3-min cap.

### 0:00 – 0:15 — Cold open
- Visual: dashboard landing page (`/`)
- Voiceover: "Every year, millions of formal proofs and engineering
  predictions are produced. Almost none are paid for at the moment of
  verification. Ascertainty changes that."

### 0:15 – 0:30 — The thesis
- Visual: scroll past the hero to the "live counter" stats
- Voiceover: "Verifiable claims become bountied. Solvers race to
  produce accepted proofs. Settlement is autonomous and on-chain."

### 0:30 – 0:55 — Post a bounty
- Visual: navigate to `/bounties/new`. Click the **sort** quick-fill.
  Click **Create bounty**.
- Voiceover: "I'm posting a bounty against a sorting-correctness
  theorem — 1,000 USDC for a Lean4 proof, 30-second challenge window."
- Wait for the success card showing on-chain bounty id + tx hash.

### 0:55 – 1:25 — Submit a proof
- Visual: open a terminal split-screen with the dashboard
  (`/race/<id>` open). Run:

  ```bash
  curl -X POST https://api.ascertainty.xyz/bounty/submit \
    -H 'content-type: application/json' \
    -d '{"bounty_id": <ID>, "solver_address": "0xd932…", "proof": "theorem t : True := trivial"}'
  ```

- Voiceover: "A solver submits a proof. The agent verifies it,
  signs an attestation, uploads to 0G Storage, fetches a
  TEE-verified explanation from 0G Compute, and posts on-chain."

### 1:25 – 2:10 — The race
- Visual: switch focus to the 3D viewer at `/race/<id>`. The car
  drives along the procedural track over the 30-second challenge
  window.
- Voiceover: "Each bounty becomes a procedural track derived from
  the proof's dependency graph. Each solver is a car. The race is
  driven by real on-chain events — every progress checkpoint comes
  from BountyFactory's event log."

### 2:10 – 2:30 — Settlement + agent panel
- Visual: when the car finishes, switch to `/agent`. Show all four
  0G pillars green + the latest KeeperHub execution in the panel.
- Voiceover: "Auto-claim fires after the challenge window. USDC
  settles. Reputation increments. The agent's own ERC-7857 iNFT,
  whose identity blob lives on 0G Storage, anchors all of this on
  0G Chain — and KeeperHub MCP fires its workflow on every accept."

### 2:30 – 2:50 — Closing
- Visual: zoom on the agent panel showing iNFT token #1 + Storage
  root + KH execution.
- Voiceover: "Ascertainty. Where proofs pay. The verification
  creates competition. The competition creates spectacle. The
  spectacle creates a market."

## Recording tips

- Use OBS or QuickTime in 1080p, 60fps if your machine can handle the
  R3F render at that rate. Otherwise 30fps is fine.
- Record a single take with voiceover, then trim. Two takes max.
- Pre-create the bounty before recording so the form returns
  successfully on the first click.
- Keep the camera mode on **follow** for the race shot — most
  cinematic for a single car. (Press `C` in the viewer to cycle if
  you want orbit / overview / cinematic.)
- The "restart race" button in the top-left of /race/<id> is your
  friend if you want to re-record the racing beat without making a
  new bounty.

## Submission day checklist

- [ ] All four "Live URLs" in this document return 200
- [ ] Backend `docker compose ps` shows `ascertainty_api` healthy
- [ ] At least one bounty in production with full lifecycle visible
      (created → submitted → settled) for the submission to demo
      against
- [ ] iNFT panel at /agent shows `ready: true`
- [ ] Demo video uploaded (YouTube unlisted is fine; ETHGlobal accepts)
- [ ] Repo README has the live URLs at top
- [ ] FEEDBACK.md committed and visible from repo root
- [ ] Form submitted before the May 3 deadline

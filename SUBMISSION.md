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
A universal verification oracle: Lean 4 proofs verified deterministically, settled in MockUSDC on 0G Galileo testnet.
```

## Tagline
```
Where proofs pay.
```

## Long description (the "What does it do?" field)

```
Ascertainty is a settlement layer for verified intellectual work.
Posters publish a YAML bounty spec (Lean theorem signature, mathlib
SHA, axiom whitelist, USDC amount, deadline, challenge window) and
escrow MockUSDC into a BountyFactory contract on 0G Galileo testnet.
A solver — human, AI agent, or human-with-AI in the spirit of Liam
Price's recent Erdős #1196 result — submits a Lean 4 proof. The
operator's verifier spawns the real lean v4.10.0 binary, parses
the kernel exit code and #print axioms output, signs an attestation
(EIP-191), uploads it to 0G Storage, fetches a TEE-verified
explanation from 0G Compute, and posts submitProofFor on-chain.
Crucially, submitProofFor uses ECDSA recovery so the operator pays
gas while the on-chain solver of record is the connected wallet
that signed off-chain — the demo shows three persona solvers
(Aggressive Andy, Careful Carl, Balanced Bea), each with their
own keypair and ERC-7857-inspired iNFT. After the challenge window,
auto-claim fires and MockUSDC settles to the recovered solver.

Three integrations make every bounty richer:
1. AI bounty creation — the poster describes their claim in plain
   English; 0G Compute (Sealed Inference) autoformalizes a draft
   Lean spec, scores novelty + difficulty 1–10 each, flags Erdős-
   class entries (both ≥ 9), and detects duplicates against existing
   bounties via Jaccard similarity over theorem signatures.
2. Earnable solver badges — the system computes 9 GitHub-style
   achievement badges per persona from real DB + on-chain activity
   (PDE Specialist, Mathlib Gap Closer, Gasless Pioneer, Streak: 3,
   Kernel Speedrun, etc.) and lets each persona curate which
   badges they wear on their card.
3. Mission Control — every bounty has a live telemetry view at
   /mission/[id] showing each persona's proof progress, accept
   rate, kernel speed, settlement countdown, and a streaming event
   feed. Replaces an earlier 3D racing prototype because telemetry
   is what verification actually looks like.

Built solo for ETHGlobal Open Agents 2026.
```

## How it's made (technical "How did you build this?" field)

```
Stack:
  Backend  — Python 3.12 + FastAPI + SQLite (WAL); web3.py for 0G
             Galileo; python-0g (a0g) SDK for 0G Storage + 0G Compute;
             eth-account for EIP-191 signing and on-chain ECDSA
             recovery; lean v4.10.0 (elan) inside the Docker image
             for the real verifier path.
  Contracts — Solidity 0.8.24 + OpenZeppelin via Hardhat. Deployed
             to 0G Galileo (chain 16602): BountyFactory (with
             submitProofFor + OZ ECDSA), SolverRegistry, AgentNFT
             (ERC-7857-inspired, multi-tokens-per-contract), MockUSDC
             (permissionless faucet).
  Dashboard — Next.js 14 (App Router) + Tailwind. wagmi v2 + viem
             v2 + RainbowKit v2 for wallet connect (full sign-in:
             create bounty + submit proof + faucet, all from the
             user's MetaMask). Mission Control telemetry view is
             pure HTML/CSS — no 3D engine — using the same race
             event stream the deleted Three.js scene used to render.
  Settlement — watcher polls BountyFactory events every 5s (safe:
             Status.Open → Submitted is atomic on-chain, racing
             second submitters revert with `not open`); claim_task
             fires claimBounty after each challenge window expires,
             signed by whichever persona's privkey owns the
             submission so the persona — not the operator —
             is the on-chain claimer; KeeperHub MCP execute_workflow
             logs every accept to kh_executions.
  iNFTs    — three solver personas (Andy / Carl / Bea). Each has a
             deterministic keypair (HKDF from operator key + slug),
             a small OG drip from the operator for gas, an identity
             blob uploaded to 0G Storage from its own wallet, and a
             distinct AgentNFT token minted by that wallet. Operator
             is the relayer; the personas are the on-chain solvers.
  AI assist — three /bounty/assist/* endpoints powered by 0G Compute
             Sealed Inference (qwen / llama / gpt-class chat models
             via the SDK's auto-discovered providers): formalize
             (English → draft Lean spec YAML), rate (novelty 1–10 +
             difficulty 1–10 + Erdős-class flag when both ≥ 9),
             check-duplicate (exact spec_hash collision blocks; 70%+
             Jaccard over theorem-signature tokens warns). Heuristic
             fallback when the provider rotates out so the demo
             never 503s; the response includes a `fallback: true`
             flag so the UI surfaces an honest 'heuristic mode'
             indicator.
  Demo      — hosted on a Contabo VPS (FastAPI behind nginx + Let's
             Encrypt via certbot --nginx) and Vercel (Next.js
             dashboard, custom domain ascertainty.xyz). Single-
             command redeploy via scripts/deploy-contabo.sh.

Key engineering decisions:
  - Gasless solver-relayer flow via submitProofFor. Solver signs
    keccak(abi.encode("Ascertainty submitProof", bountyId,
    attestationHash, factory_addr)) wrapped in EIP-191 personal_sign;
    the operator submits on-chain and OZ ECDSA recovery validates
    that the recovered address matches the claimed solver. Solver
    can claim later because b.solver was set to the recovered
    address, not the relayer.
  - Real Lean 4 kernel (v4.10.0) installed in the Docker image via
    elan. backend/lean_runner.py spawns `lean` against a temp file
    per submission, parses the actual exit code + #print axioms
    output, times out at 30s. verifier_mode: real_lean4 vs
    mock_lean4 is recorded in every attestation so consumers can
    tell which path ran. Phase 1 scope: stdlib-only. Mathlib-
    pinned verification per spec.mathlib_sha is Phase 2.
  - Persona iNFT minting respects the contract's 1-per-wallet
    invariant. Each of the three personas mints from its own
    derived wallet after a small operator-funded gas drip. The
    contract's ERC-7857 metadata (storageRootHash + modelDescriptor
    + versionTag) is set per-persona at mint, so the on-chain blob
    pointers per token differ.
  - Earnable badges are pure functions of (submissions ∪ on-chain
    settlements), not pre-declared traits. The 9 catalog rules in
    backend/badges.py walk each persona's submission timeline +
    bounty.spec_yaml tags and emit a sorted earned-list. Personas
    set their displayed-badge slate via POST /agent/personas/{slug}/
    wear; default wear-all-earned. No auth in the demo build — in
    production this would gate on a signature from the persona's
    privkey.
  - 0G Compute resilience. The provider list rotates and signed
    headers expire after a few minutes. og_compute rebuilds the
    OpenAI-compatible client per request and falls back to
    deterministic heuristics on failure (theorem-keyword detection
    for novelty, length + axiom-count for difficulty), so the AI
    assist endpoints never hard-fail and the response carries a
    `fallback: true` flag the UI surfaces.

Open-source acknowledgments (full text in dashboard/lib/ATTRIBUTIONS.md):
  - python-0g (a0g) SDK — 0G Storage + 0G Compute integration
  - OpenZeppelin Contracts — ERC-20, ECDSA, ReentrancyGuard
  - wagmi + viem + RainbowKit — wallet connect on the dashboard
```

## Prize-track justifications (paste into respective fields)

### 0G ($15,000)

```
All four 0G pillars in production, plus three load-bearing uses
of each (not just integration checkboxes):

1. 0G Chain (Galileo testnet, chainId 16602):
   - BountyFactory at 0x11E351EA4Ec6F9163916c1941320a0F6d2b80C1c
     (with submitProofFor + OZ ECDSA recovery)
   - SolverRegistry at 0x6E5CEb3Ac85dA96479A0C080E7fB8D5762551A32
   - AgentNFT at 0x0cf5c9dd2CF3E48b2E1078995289d6b0690f1105
     (now holds 4 iNFTs: token #1 operator + #2 Andy + #3 Carl + #4 Bea)
   - MockUSDC at 0x8D53B5b599caA7205fB869A14Dd7141c3866010a
   Settlement loop end-to-end: poster → BountyFactory.createBounty
   from connected MetaMask → solver signs EIP-191 → operator relays
   submitProofFor → challenge window → persona-signed claimBounty.
   Real txs visible at chainscan-galileo.0g.ai for every step.

2. 0G Storage:
   Three load-bearing uses:
   (a) Per-attestation JSON blob uploaded for every accepted
       submission; root anchored on-chain as the bytes32
       attestationHash argument to submitProofFor.
   (b) Per-persona identity blob (model descriptor, axiom-whitelist
       breadth, profile, deployed contract addresses) — three roots,
       one per persona iNFT, set as the AgentNFT.metadata.storageRootHash.
   (c) 0G Storage roots surface in the per-bounty evidence page
       and the Mission Control event feed so judges can verify the
       artefacts independently.

3. 0G Compute (Sealed Inference):
   Three load-bearing uses:
   (a) Per-bounty TEE-verified explanation generated at /bounty/create
       time so every bounty card carries a 2-sentence gloss before
       the first submission lands (not just on the settled bounty).
   (b) Per-submission TEE-verified explanation of why the proof was
       accepted, persisted on the submission record.
   (c) AI bounty assist: formalize (English → Lean spec), rate
       (novelty + difficulty 1–10 with Erdős-class flag), powered
       by the same provider auto-discovery. Heuristic fallback when
       providers rotate.

4. 0G iNFT (ERC-7857-inspired):
   AgentNFT contract holds 4 tokens (operator + 3 personas), each
   with distinct on-chain metadata (storageRootHash, modelDescriptor,
   versionTag). Personas mint from their own derived wallets after
   a tiny operator-funded gas drip — the contract's 1-token-per-
   wallet invariant is honored. Cards rendered on /agent use the
   on-chain metadata + DB-derived live stats (acceptance rate,
   kernel speed, settled count, domain affinities) + 9-rule
   earnable badge engine. Personas curate which badges they 'wear'
   on the card via POST /agent/personas/{slug}/wear.

Architecture: backend/og_chain.py wires web3 to Galileo;
backend/og_storage.py + backend/og_compute.py wrap python-0g;
backend/inft.py + backend/personas.py run the four mint flows on
startup; backend/badges.py is the 9-rule achievement engine.
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
| 0G Galileo BountyFactory | https://chainscan-galileo.0g.ai/address/0x11E351EA4Ec6F9163916c1941320a0F6d2b80C1c |
| 0G Galileo AgentNFT (4 iNFTs) | https://chainscan-galileo.0g.ai/address/0x0cf5c9dd2CF3E48b2E1078995289d6b0690f1105 |

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

### 0:30 – 0:55 — AI-assisted bounty creation
- Visual: navigate to `/bounties/new`. Connect MetaMask via the
  RainbowKit button (top-right). Type into the AI Assist box:
  "Prove that for every prime p > 2, the multiplicative group of
  integers modulo p is cyclic." Tags: `number-theory, group-theory`.
  Click **✨ Autoformalize**, then **Rate spec**, then **Check
  duplicates**.
- Voiceover: "Posting a bounty starts with English. 0G Compute
  Sealed Inference autoformalizes the claim into a Lean spec, scores
  novelty and difficulty 1 to 10 each, and flags Erdős-class entries
  — both ratings ≥ 9 — anchored on the Liam Price / Erdős #1196
  result. It also checks for duplicates by Jaccard similarity over
  theorem signatures."

### 0:55 – 1:20 — Wallet-driven escrow
- Visual: click **Mint 1,000 demo USDC** (faucet from connected
  wallet). Approve. Click **Create bounty**. Watch the wagmi
  transaction sign + broadcast. Land on the bounty detail page.
- Voiceover: "MockUSDC mints permissionlessly into the user's
  wallet. They approve and call BountyFactory.createBounty
  themselves — the operator never touches the escrow. Their address
  is the on-chain poster of record."

### 1:20 – 1:55 — Gasless proof submission via submitProofFor
- Visual: scroll to the SubmitProofForm. Connect a different wallet
  (or stay connected). The default sample proof
  `theorem t : True := trivial` is pre-filled. Click **Submit**.
  MetaMask pops up to sign the EIP-191 message hash. After signing,
  watch the operator relay the transaction.
- Voiceover: "A solver submits a Lean proof. The connected wallet
  signs an EIP-191 message; the operator pays gas and calls
  submitProofFor; on-chain ECDSA recovery validates the signature
  so the recovered address — not the relayer — becomes the
  solver of record. Solver paid no gas; only the recovered address
  can claim."

### 1:55 – 2:25 — Mission Control + persona settlement
- Visual: navigate to `/mission/<bounty-id>`. Show the three persona
  lanes (Andy 🔥, Carl 🧊, Bea ⚖️) with live progress bars,
  acceptance %, kernel speed, and the live event feed scrolling
  underneath. Watch the settlement countdown tick down. When it
  hits zero, the lane turns cyan + the amount counter pulses.
- Voiceover: "Mission Control is the live telemetry view —
  three solver personas, each with their own ERC-7857-inspired
  iNFT minted from their own wallet, race against each other.
  When the challenge window expires, claim_task fires claimBounty
  signed by the persona's privkey. The watcher catches the
  BountyClaimed event; the lane turns green; reputation
  increments on-chain in SolverRegistry."

### 2:25 – 2:50 — Agent panel + earned badges
- Visual: navigate to `/agent`. Show the three persona Pokemon-
  style cards. Andy now has 🥇 First Bounty + ⛽ Gasless Pioneer +
  💰 Claimer + 📊 Algorithms Prover earned. Click his trophy
  shelf to expand — show locked badges in grey. Toggle one to
  hide/show via the wear endpoint.
- Voiceover: "Each persona earns achievement badges from real
  activity — domain affinities from accepted submissions, Gasless
  Pioneer for first submitProofFor win, Kernel Speedrun for sub-50ms
  verifications. Personas curate which badges they wear via a
  signed wear endpoint. Below the cards: all four 0G pillars and
  KeeperHub MCP execution log."

### 2:50 – 3:00 — Closing
- Visual: hero shot back on landing page; cursor near the TESTNET
  chip.
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

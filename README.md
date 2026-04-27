# Ascertainty

Where proofs pay.

A universal verification oracle: formal proofs and engineering predictions
verified deterministically, settled in USDC on 0G Chain, and visualized as
real-time 3D racing.

Status: in development (ETHGlobal Open Agents 2026).

## Local dev

```bash
# 1. Backend (FastAPI + SQLite + 0G integrations)
python3 -m venv venv
venv/bin/pip install -r requirements.txt
cp .env.example .env             # then fill in OG_PRIVATE_KEY etc.
venv/bin/uvicorn backend.main:app --port 8000

# 2. Dashboard (Next.js + R3F)
cd dashboard
npm install --legacy-peer-deps
npm run dev                       # http://localhost:3000

# 3. One-time on-chain setup (mints MockUSDC + approves BountyFactory)
venv/bin/python -m cli.ascertainty bootstrap

# 4. Optional: seed mock race events for the dashboard demo
venv/bin/python -m cli.ascertainty seed-race 1
```

## Deployed contracts (0G Galileo, chain 16602)

See [`backend/contract_addresses.json`](backend/contract_addresses.json):
`MockUSDC`, `SolverRegistry`, `BountyFactory`, `AgentNFT`.

## Deploy

- **Frontend** → Vercel auto-deploys `dashboard/` on every push to main.
  Set `NEXT_PUBLIC_API_URL` per environment to point at the public backend.
- **Backend** → run `venv/bin/uvicorn backend.main:app` on any host with
  outbound access to `evmrpc-testnet.0g.ai`. The `.env` file holds the
  operator wallet + KeeperHub + Telegram + Alchemy keys.

## Open-source attributions

See [`dashboard/lib/ATTRIBUTIONS.md`](dashboard/lib/ATTRIBUTIONS.md).

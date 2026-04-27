# Ascertainty Dashboard

Next.js 14 (App Router) frontend: landing, bounties, leaderboard, and the racing visualization.

## Local dev

```bash
npm install
npm run dev   # http://localhost:3000
```

The dashboard expects the Ascertainty backend at `NEXT_PUBLIC_API_URL`
(default `http://localhost:8000`). Boot it with:

```bash
cd ..
venv/bin/uvicorn backend.main:app --port 8000
```

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS (custom dark theme: `#050507` bg, `#00d4aa` cyan accent)
- Three.js + React Three Fiber + cannon-es (loaded client-only via `next/dynamic`)
- JetBrains Mono for data, Inter for prose

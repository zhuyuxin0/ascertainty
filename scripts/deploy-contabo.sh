#!/usr/bin/env bash
# Deploy Ascertainty backend to a Contabo (or any Docker-enabled) VPS.
# Run from your local machine. Pass the SSH target as the first argument.
#
# Usage:
#   ./scripts/deploy-contabo.sh root@your-vps-ip
#   ./scripts/deploy-contabo.sh user@vmiNNNN.contaboserver.net
#
# Prerequisites on the VPS:
#   - Docker + docker compose plugin installed
#   - Ports 80 + 443 free (Caddy will bind them)
#   - DNS A record api.ascertainty.xyz -> VPS IP already propagated
#
# Local prereqs:
#   - SSH key auth working to the target
#   - .env populated with all keys (incl. LE_EMAIL)

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <ssh_target>"
  echo "  e.g. $0 root@1.2.3.4"
  exit 1
fi

SSH_TARGET="$1"
REMOTE_DIR="${REMOTE_DIR:-/srv/ascertainty}"

echo "==> deploying to $SSH_TARGET into $REMOTE_DIR"

# Pre-flight check
if [ ! -f .env ]; then
  echo "error: .env missing — populate it (copy from .env.example) before deploying" >&2
  exit 1
fi
if ! grep -q '^LE_EMAIL=.\+' .env; then
  echo "warning: LE_EMAIL is empty in .env — Let's Encrypt cert renewal will be silent" >&2
fi

# 1. Make sure remote dir exists
ssh "$SSH_TARGET" "mkdir -p $REMOTE_DIR"

# 2. Sync source — exclude things we don't need on the server
echo "==> rsync source"
rsync -avz --delete \
  --exclude '.git' \
  --exclude '.next' \
  --exclude 'node_modules' \
  --exclude 'venv' \
  --exclude '__pycache__' \
  --exclude '.env.example' \
  --exclude 'dashboard' \
  --exclude 'docs' \
  --exclude 'contracts/artifacts' \
  --exclude 'contracts/cache' \
  --exclude 'contracts/node_modules' \
  --exclude 'data/*.db*' \
  --exclude 'data/telegram_subs.json' \
  --exclude 'CLAUDE.md' \
  --exclude 'AGENTS.md' \
  ./ "$SSH_TARGET:$REMOTE_DIR/"

# 3. Sync .env separately (rsync above excluded .env.example only; .env is in
#    .dockerignore but we DO need it in the repo dir for docker compose env_file)
echo "==> rsync .env"
scp .env "$SSH_TARGET:$REMOTE_DIR/.env"

# 4. Build + start (or restart)
echo "==> docker compose up --build -d"
ssh "$SSH_TARGET" "cd $REMOTE_DIR && docker compose up -d --build"

# 5. Show logs briefly so we can confirm boot
echo "==> tailing api logs (Ctrl-C to stop)"
ssh "$SSH_TARGET" "cd $REMOTE_DIR && docker compose logs --tail=30 api"

cat <<EOF

==> Done. Verify:
  curl https://api.ascertainty.xyz/health   # expect {"status":"ok",...}

  Watch logs:    ssh $SSH_TARGET 'cd $REMOTE_DIR && docker compose logs -f api'
  Restart:       ssh $SSH_TARGET 'cd $REMOTE_DIR && docker compose restart api'
  Stop:          ssh $SSH_TARGET 'cd $REMOTE_DIR && docker compose down'
EOF

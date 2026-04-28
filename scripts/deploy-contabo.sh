#!/usr/bin/env bash
# Deploy Ascertainty backend to a Contabo (or any Docker + nginx) VPS.
# Run from your local machine. Pass the SSH target as the first argument.
#
# Usage:
#   ./scripts/deploy-contabo.sh <ssh-alias>       # uses ~/.ssh/config alias
#   ./scripts/deploy-contabo.sh root@1.2.3.4
#
# Prerequisites on the VPS:
#   - Docker + docker compose plugin installed
#   - nginx running (we add a server block)
#   - certbot installed (we use the --nginx plugin for HTTPS)
#   - DNS A record api.ascertainty.xyz -> VPS IP propagated
#
# Local prereqs:
#   - SSH key auth working to the target
#   - .env populated (incl. LE_EMAIL for cert renewal notifications)

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <ssh_target>"
  exit 1
fi

SSH_TARGET="$1"
REMOTE_DIR="${REMOTE_DIR:-/srv/ascertainty}"
DOMAIN="${DOMAIN:-api.ascertainty.xyz}"

if [ ! -f .env ]; then
  echo "error: .env missing — populate it before deploying" >&2
  exit 1
fi

LE_EMAIL=$(grep '^LE_EMAIL=' .env | cut -d= -f2-)
if [ -z "$LE_EMAIL" ]; then
  echo "error: LE_EMAIL must be set in .env (used by certbot)" >&2
  exit 1
fi

echo "==> deploying to $SSH_TARGET into $REMOTE_DIR ($DOMAIN)"

# 1. Ensure remote dir exists (sudo because /srv requires root to create)
ssh "$SSH_TARGET" "sudo mkdir -p $REMOTE_DIR && sudo chown \$(whoami):\$(whoami) $REMOTE_DIR"

# 2. Sync source
echo "==> rsync source"
rsync -avz --delete \
  -e "ssh" \
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

# 3. Sync .env separately (excluded above)
echo "==> rsync .env"
scp .env "$SSH_TARGET:$REMOTE_DIR/.env"

# 4. Build + start the docker container
echo "==> docker compose up --build -d"
ssh "$SSH_TARGET" "cd $REMOTE_DIR && docker compose up -d --build"

# 5. Wait for healthy
echo "==> waiting for /health on the host loopback"
ssh "$SSH_TARGET" "for i in {1..30}; do
  if curl -sf http://127.0.0.1:8000/health >/dev/null; then echo OK; exit 0; fi
  sleep 2
done; echo FAILED; docker compose logs --tail=50 ascertainty_api; exit 1"

# 6. Install nginx server block (idempotent)
echo "==> installing nginx server block"
ssh "$SSH_TARGET" "sudo cp $REMOTE_DIR/scripts/nginx-ascertainty.conf /etc/nginx/sites-available/ascertainty && \
  sudo ln -sf /etc/nginx/sites-available/ascertainty /etc/nginx/sites-enabled/ascertainty && \
  sudo nginx -t && sudo systemctl reload nginx"

# 7. Issue (or renew) Let's Encrypt cert via the nginx plugin
echo "==> issuing/renewing Let's Encrypt cert for $DOMAIN"
ssh "$SSH_TARGET" "sudo certbot --nginx \
  -d $DOMAIN \
  --email '$LE_EMAIL' \
  --agree-tos --no-eff-email \
  --redirect --keep-until-expiring -n"

# 8. Final smoke test
echo "==> final smoke test against https://$DOMAIN/health"
sleep 2
curl -sfS "https://$DOMAIN/health" && echo "" || (echo "smoke test FAILED" && exit 1)

cat <<EOF

==> Deployed.
  Watch logs:    ssh $SSH_TARGET 'cd $REMOTE_DIR && docker compose logs -f api'
  Restart:       ssh $SSH_TARGET 'cd $REMOTE_DIR && docker compose restart api'
  Stop:          ssh $SSH_TARGET 'cd $REMOTE_DIR && docker compose down'
EOF

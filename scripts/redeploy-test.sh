#!/usr/bin/env bash
set -Eeuo pipefail

REMOTE_HOST="ams-kowedes-com"
REMOTE_DIR="/var/apps/evolyn.club/stories/_LATEST"
APP_NAME="stories.evolyn.club"

abort() {
  echo "Deployment failed" >&2
  exit 1
}

trap abort ERR

rm -rf build
npm run build

# Sync build output + package files in one shot
rsync -az \
  ./build \
  ./package.json \
  ./package-lock.json \
  ./svelte.config.js \
  "${REMOTE_HOST}:${REMOTE_DIR}/"

# Restart or reload after sync completes
ssh "$REMOTE_HOST" "
  cd '$REMOTE_DIR' &&
  source ~/.nvm/nvm.sh &&
  # npm ci --no-audit --no-fund &&
  pm2 reload $APP_NAME || pm2 restart $APP_NAME &&
  pm2 show $APP_NAME
"

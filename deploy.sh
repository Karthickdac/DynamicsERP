#!/bin/bash
set -e

cd /home/dynamicgreenenergy-erp/htdocs/erp.dynamicgreenenergy.in

echo "==> Pulling latest code..."
git fetch origin
git reset --hard origin/main

echo "==> Installing dependencies..."
pnpm install

echo "==> Building..."
pnpm --filter @workspace/api-server run build

echo "==> Restarting PM2..."
mkdir -p /var/log/dge-erp
pm2 delete dge-erp || true
pm2 start ecosystem.config.cjs --env production
pm2 save

echo "==> Done!"

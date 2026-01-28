#!/bin/bash
# Quick script to update server to latest commit

cd /data/backend

echo "📥 Pulling latest code..."
git fetch origin
git reset --hard origin/main

echo "✅ Updated to: $(git log -1 --oneline)"

echo "🐳 Checking container..."
if command -v docker-compose >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version >/dev/null 2>&1; then
  DOCKER_COMPOSE_CMD="docker compose"
else
  echo "❌ docker-compose not found"
  exit 1
fi

echo "Using: $DOCKER_COMPOSE_CMD"
echo "Container status:"
$DOCKER_COMPOSE_CMD ps

echo "Recent logs:"
$DOCKER_COMPOSE_CMD logs --tail=10 backend


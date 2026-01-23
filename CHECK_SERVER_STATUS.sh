#!/bin/bash
# Script to check server deployment status

echo "🔍 Checking server deployment status..."
echo ""

cd /data/backend || { echo "❌ /data/backend doesn't exist"; exit 1; }

echo "📍 Current directory: $(pwd)"
echo ""

echo "📋 Git status:"
git status --short
echo ""

echo "📋 Latest commits:"
git log --oneline -5
echo ""

echo "📋 Remote tracking:"
git branch -vv
echo ""

echo "📋 Remote info:"
git remote -v
echo ""

echo "🐳 Docker container status:"
docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null
echo ""

echo "🐳 Docker images:"
docker images | grep hr-backend
echo ""

echo "📋 Recent container logs:"
docker compose logs --tail=5 backend 2>/dev/null || docker-compose logs --tail=5 backend 2>/dev/null
echo ""

echo "✅ Server check complete!"


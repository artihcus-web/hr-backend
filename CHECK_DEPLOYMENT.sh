#!/bin/bash
# Quick script to verify the latest deployment on server
# Run this after GitHub Actions workflow completes

echo "🔍 Checking latest deployment..."
echo ""

# Get server details from GitHub secrets (you'll need to replace these)
# Or run this script directly on the server
SERVER_USER="${SERVER_USER:-root}"
SERVER_IP="${SERVER_IP:-your-server-ip}"

if [ -z "$SERVER_IP" ] || [ "$SERVER_IP" = "your-server-ip" ]; then
  echo "⚠️  Please set SERVER_IP environment variable or edit this script"
  echo "Example: SERVER_IP=10.9.8.146 ./CHECK_DEPLOYMENT.sh"
  exit 1
fi

echo "📡 Connecting to ${SERVER_USER}@${SERVER_IP}..."
echo ""

ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
cd /data/backend

echo "📍 Current Git Commit:"
git log -1 --oneline
echo ""

echo "🐳 Docker Container Status:"
docker ps | grep backend
echo ""

echo "🐳 Docker Image Info:"
docker images | grep hr-backend | head -1
echo ""

echo "📋 Health Check Response:"
curl -s http://127.0.0.1:3000/api/health | jq '.' 2>/dev/null || curl -s http://127.0.0.1:3000/api/health
echo ""

echo "📋 Recent Container Logs (last 10 lines):"
docker-compose logs --tail=10 backend 2>/dev/null || docker compose logs --tail=10 backend 2>/dev/null
echo ""

echo "✅ Deployment check complete!"
EOF

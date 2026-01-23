#!/bin/bash
# Quick deployment script to pull latest code and Docker image

cd /data/backend

echo "📥 Pulling latest code..."
git reset --hard origin/main

echo "✅ Code updated to: $(git log -1 --oneline)"

echo "🐳 Pulling Docker image from Docker Hub..."
docker pull harshava123/hr-backend:latest

echo "📝 Updating .env with Docker image..."
if ! grep -q "DOCKER_IMAGE" .env 2>/dev/null; then
  echo "DOCKER_IMAGE=harshava123/hr-backend:latest" >> .env
else
  sed -i "s|DOCKER_IMAGE=.*|DOCKER_IMAGE=harshava123/hr-backend:latest|" .env
fi

echo "🛑 Stopping old container..."
docker-compose down || true

echo "🧹 Cleaning up old images..."
docker image prune -f || true

echo "🚀 Starting new container..."
DOCKER_IMAGE=harshava123/hr-backend:latest docker-compose up -d

sleep 5

echo "📊 Container status:"
docker-compose ps

echo "📋 Recent logs:"
docker-compose logs --tail=20 backend

echo ""
echo "✅ Deployment complete!"
echo "📍 Latest commit: $(git log -1 --oneline)"
echo "🐳 Docker image: $(docker images | grep hr-backend | head -1)"


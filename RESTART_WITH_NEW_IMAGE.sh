#!/bin/bash
# Restart container with latest Docker image

cd /data/backend

echo "🔄 Restarting container with latest Docker image..."

# Pull latest image
echo "📥 Pulling latest Docker image..."
docker pull harshava123/hr-backend:latest

# Restart container
echo "🛑 Stopping container..."
docker-compose down

echo "🚀 Starting container with new image..."
DOCKER_IMAGE=harshava123/hr-backend:latest docker-compose up -d

sleep 5

echo "📊 Container status:"
docker-compose ps

echo "📋 Recent logs:"
docker-compose logs --tail=10 backend

echo ""
echo "✅ Container restarted!"
echo "🔍 Verifying new code in container..."
docker-compose exec backend grep -A 3 "CI/CD auto-deployment" /app/server.js


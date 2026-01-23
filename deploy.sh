#!/bin/bash
set -e
cd /data/backend
echo "Pulling latest image..."
docker pull harshava123/hr-backend:latest
echo "Cleaning up..."
docker container prune -f
echo "Restarting..."
docker-compose down --remove-orphans
docker-compose up -d
sleep 5
echo "Deployed successfully!"
docker ps

#!/bin/bash

# Script to start hr-backend-prod container with uploads volume mounted

echo "=========================================="
echo "Starting HR Backend Container with Uploads Volume"
echo "=========================================="
echo ""

# Create uploads directory if it doesn't exist
echo "1. Creating uploads directory..."
mkdir -p /root/hr-backend/uploads/profiles
chmod 755 /root/hr-backend/uploads/profiles
echo "✅ Directory created"
echo ""

# Check if .env file exists to load environment variables
if [ -f /root/hr-backend/.env ]; then
    echo "2. Loading environment variables from .env..."
    source /root/hr-backend/.env
    echo "✅ Environment variables loaded"
else
    echo "⚠️  No .env file found. Using defaults or you'll need to set variables manually."
fi
echo ""

# Start container with volume mounts
echo "3. Starting container with uploads volume..."
docker run -d \
  --name hr-backend-prod \
  --restart unless-stopped \
  --network host \
  -v /root/hr-backend/logs:/app/logs \
  -v /root/hr-backend/uploads:/app/uploads \
  -e NODE_ENV=production \
  -e MONGODB_URI="${MONGODB_URI:-mongodb://admin:Artihcus%40123@localhost:27017/myapp?authSource=admin}" \
  -e PORT=5000 \
  -e JWT_SECRET="${JWT_SECRET:-your-secret-key-change-this-in-production}" \
  -e FRONTEND_URL="${FRONTEND_URL:-https://hr.artihcus.com}" \
  -e EMAIL_USER="${EMAIL_USER}" \
  -e EMAIL_PASSWORD="${EMAIL_PASSWORD}" \
  harshava123/hr-backend:latest

echo ""
echo "4. Checking container status..."
sleep 2
docker ps | grep hr-backend-prod
echo ""

echo "5. Verifying uploads directory is mounted..."
docker exec hr-backend-prod ls -la /app/uploads/profiles
echo ""

echo "=========================================="
echo "✅ Container started!"
echo "=========================================="
echo ""
echo "To check logs: docker logs -f hr-backend-prod"
echo "To stop: docker stop hr-backend-prod"
echo "To restart: docker restart hr-backend-prod"
echo ""

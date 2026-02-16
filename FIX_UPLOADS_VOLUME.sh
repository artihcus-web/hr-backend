#!/bin/bash

echo "=========================================="
echo "Fixing Uploads Directory Persistence"
echo "=========================================="
echo ""

CONTAINER_NAME="hr-backend-prod"
UPLOADS_DIR="/root/hr-backend/uploads"

echo "1. Creating uploads directory on host..."
mkdir -p $UPLOADS_DIR/profiles
chmod 755 $UPLOADS_DIR/profiles
echo "✅ Created: $UPLOADS_DIR/profiles"
echo ""

echo "2. Checking current container status..."
docker ps | grep $CONTAINER_NAME
echo ""

echo "3. Stopping container..."
docker stop $CONTAINER_NAME
echo ""

echo "4. Removing old container..."
docker rm $CONTAINER_NAME
echo ""

echo "5. Starting container with uploads volume mount..."
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  --network host \
  -v $(pwd)/logs:/app/logs \
  -v $UPLOADS_DIR:/app/uploads \
  -e NODE_ENV=production \
  -e MONGODB_URI="${MONGODB_URI}" \
  -e PORT=5000 \
  -e JWT_SECRET="${JWT_SECRET}" \
  -e FRONTEND_URL="${FRONTEND_URL}" \
  -e EMAIL_USER="${EMAIL_USER}" \
  -e EMAIL_PASSWORD="${EMAIL_PASSWORD}" \
  harshava123/hr-backend:latest
echo ""

echo "6. Verifying container is running..."
docker ps | grep $CONTAINER_NAME
echo ""

echo "7. Verifying uploads directory is mounted..."
docker exec $CONTAINER_NAME ls -la /app/uploads/profiles
echo ""

echo "8. Testing write permissions..."
docker exec $CONTAINER_NAME touch /app/uploads/profiles/test.txt
docker exec $CONTAINER_NAME rm /app/uploads/profiles/test.txt
echo "✅ Write permissions OK"
echo ""

echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "Uploads directory is now persisted at: $UPLOADS_DIR"
echo "Images will survive container restarts."
echo ""

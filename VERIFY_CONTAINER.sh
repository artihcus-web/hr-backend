#!/bin/bash

echo "=========================================="
echo "Verifying HR Backend Container Status"
echo "=========================================="
echo ""

CONTAINER_NAME="hr-backend-prod"

echo "1. Checking container status..."
docker ps | grep $CONTAINER_NAME
if [ $? -eq 0 ]; then
    echo "✅ Container is running"
else
    echo "❌ Container is NOT running"
    exit 1
fi
echo ""

echo "2. Checking container health (last 20 log lines)..."
docker logs $CONTAINER_NAME --tail 20
echo ""

echo "3. Testing backend health endpoint..."
HEALTH_RESPONSE=$(docker exec $CONTAINER_NAME curl -s http://localhost:5000/api/health 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Backend is responding:"
    echo "$HEALTH_RESPONSE" | head -5
else
    echo "❌ Backend health check failed"
fi
echo ""

echo "4. Checking uploads directory mount..."
docker exec $CONTAINER_NAME ls -la /app/uploads/profiles 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Uploads directory is accessible"
else
    echo "❌ Uploads directory not accessible"
fi
echo ""

echo "5. Checking if uploads directory is writable..."
docker exec $CONTAINER_NAME touch /app/uploads/profiles/test-write.txt 2>/dev/null
if [ $? -eq 0 ]; then
    docker exec $CONTAINER_NAME rm /app/uploads/profiles/test-write.txt 2>/dev/null
    echo "✅ Uploads directory is writable"
else
    echo "❌ Uploads directory is NOT writable"
fi
echo ""

echo "6. Checking container resource usage..."
docker stats $CONTAINER_NAME --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo ""

echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Useful commands:"
echo "  - View logs: docker logs -f $CONTAINER_NAME"
echo "  - Restart: docker restart $CONTAINER_NAME"
echo "  - Stop: docker stop $CONTAINER_NAME"
echo "  - Check status: docker ps | grep $CONTAINER_NAME"
echo ""

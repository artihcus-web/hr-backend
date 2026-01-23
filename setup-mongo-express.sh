#!/bin/bash

# Setup mongo-express web UI for MongoDB

echo "🚀 Setting up mongo-express..."

cd /data/backend

# Create docker-compose file for mongo-express
cat > docker-compose-mongo-express.yml << 'EOF'
version: '3.8'

services:
  mongo-express:
    image: mongo-express:latest
    container_name: mongo-express
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_ADMINUSERNAME: admin
      ME_CONFIG_MONGODB_ADMINPASSWORD: Artihcus@123
      ME_CONFIG_MONGODB_URL: mongodb://admin:Artihcus%40123@host.docker.internal:27017/
      ME_CONFIG_BASICAUTH_USERNAME: admin
      ME_CONFIG_BASICAUTH_PASSWORD: admin123
    network_mode: host
EOF

# Start mongo-express
echo "📦 Starting mongo-express container..."
docker-compose -f docker-compose-mongo-express.yml up -d

# Wait a moment
sleep 3

# Check if it's running
if docker ps | grep -q mongo-express; then
    echo "✅ mongo-express is running!"
    echo ""
    echo "🌐 Access mongo-express at:"
    echo "   URL: http://97.77.20.150:8081"
    echo "   Username: admin"
    echo "   Password: admin123"
    echo ""
    echo "📝 Note: You may need to add port forwarding for 8081 on your router"
    echo "   External port: 8081 → Internal: 192.168.0.233:8081"
else
    echo "❌ Failed to start mongo-express"
    echo "Check logs: docker-compose -f docker-compose-mongo-express.yml logs"
fi


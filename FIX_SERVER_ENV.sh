#!/bin/bash

# Configuration
SERVER_USER="root"
SERVER_IP="192.168.0.233" # Default
DEFAULT_MONGO_URI="mongodb://admin:Artihcus%40123@localhost:27017/myapp?authSource=admin"

read -p "Enter Server IP [192.168.0.233]: " INPUT_IP
if [ ! -z "$INPUT_IP" ]; then
    SERVER_IP=$INPUT_IP
fi

echo "🔧 Connecting to $SERVER_IP to fix Environment Variables..."

ssh $SERVER_USER@$SERVER_IP << EOF
    cd /data/backend
    
    # 1. Check current .env
    echo "Current .env (MONGODB_URI):"
    grep "MONGODB_URI" .env || echo "MONGODB_URI not found!"
    
    # 2. Force update MONGODB_URI
    # Using sed to replace or append if missing
    if grep -q "MONGODB_URI" .env; then
        sed -i 's|MONGODB_URI=.*|MONGODB_URI=${DEFAULT_MONGO_URI}|' .env
    else
        echo "MONGODB_URI=${DEFAULT_MONGO_URI}" >> .env
    fi
    
    echo "✅ Updated MONGODB_URI to: ${DEFAULT_MONGO_URI}"
    
    # 3. Restart Container to pick up new env
    echo "🔄 Restarting Backend Container..."
    docker compose -f docker-compose.prod.yml down
    docker compose -f docker-compose.prod.yml up -d
    
    echo "⏳ Waiting for startup..."
    sleep 5
    docker logs hr-backend-prod --tail 20
EOF

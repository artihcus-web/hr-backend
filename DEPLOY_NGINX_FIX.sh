#!/bin/bash

# Configuration
SERVER_USER="root"
SERVER_IP="192.168.0.233" # Defaults to the IP seen in logs, user can override
REMOTE_PATH="/data/backend"
NGINX_CONFIG_PATH="/etc/nginx/sites-available/default"

echo "🚀 Deploying Nginx CORS Fix..."

# 1. Ask for IP if not set (or use default)
read -p "Enter Server IP [103.111.97.108 / 192.168.0.233]: " INPUT_IP
if [ ! -z "$INPUT_IP" ]; then
    SERVER_IP=$INPUT_IP
fi

echo "Connecting to $SERVER_USER@$SERVER_IP..."

# 2. Upload the new Nginx config
echo "📤 Uploading nginx-final-cors-fix.conf..."
scp nginx-final-cors-fix.conf $SERVER_USER@$SERVER_IP:/tmp/nginx_fix.conf

if [ $? -ne 0 ]; then
    echo "❌ Upload failed. Check SSH connection/VPN."
    exit 1
fi

# 3. Apply Config on Server
echo "🔧 Applying configuration on server..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
    # Backup old config
    cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak.$(date +%F_%T)
    
    # Move new config in place
    mv /tmp/nginx_fix.conf /etc/nginx/sites-available/default
    
    # Test Config
    echo "Testing Nginx config..."
    nginx -t
    
    if [ $? -eq 0 ]; then
        echo "✅ Config Valid. Restarting Nginx..."
        systemctl restart nginx
        echo "✅ Nginx Restarted."
    else
        echo "❌ Config Invalid! Rolling back..."
        mv /etc/nginx/sites-available/default.bak* /etc/nginx/sites-available/default
        systemctl restart nginx
        exit 1
    fi
    
    # Also restart Backend to ensure new code (server.js) is effective
    echo "🔄 Restarting Backend Container..."
    cd /data/backend
    # Ensure we use the prod config
    docker compose -f docker-compose.prod.yml restart backend
EOF

echo "✅ Deployment Complete. Please test https://hr.artihcus.com"

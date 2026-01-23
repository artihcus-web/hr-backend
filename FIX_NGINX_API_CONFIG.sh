#!/bin/bash

# Fix Nginx config for api.grahmind.com to proxy to port 5000 instead of 3000

echo "🔧 Fixing Nginx configuration for api.grahmind.com..."

# Backup current config
sudo cp /etc/nginx/sites-available/api.grahmind.com /etc/nginx/sites-available/api.grahmind.com.backup

# Create new config that proxies to port 5000
sudo tee /etc/nginx/sites-available/api.grahmind.com > /dev/null << 'EOF'
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name api.grahmind.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.grahmind.com;

    ssl_certificate /etc/letsencrypt/live/api.grahmind.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.grahmind.com/privkey.pem;

    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Proxy to backend on port 5000
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Test Nginx config
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx config is valid"
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
    echo ""
    echo "🧪 Testing CORS..."
    curl -H "Origin: https://fer-henna-omega.vercel.app" \
         -H "Access-Control-Request-Method: POST" \
         -X OPTIONS \
         https://api.grahmind.com:8443/api/auth/signup -v 2>&1 | grep -i "access-control-allow-origin"
else
    echo "❌ Nginx config test failed. Restoring backup..."
    sudo cp /etc/nginx/sites-available/api.grahmind.com.backup /etc/nginx/sites-available/api.grahmind.com
    exit 1
fi


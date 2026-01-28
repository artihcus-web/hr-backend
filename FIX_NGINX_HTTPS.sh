#!/bin/bash
# Fix Nginx HTTPS Configuration for api.grahmind.com

# Backup current config
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup

# Create new configuration
sudo tee /etc/nginx/sites-available/default > /dev/null <<EOF
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name api.grahmind.com;
    return 301 https://\$server_name\$request_uri;
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

    # Proxy to backend
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Test configuration
sudo nginx -t

# If test passes, reload Nginx
if [ \$? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Nginx configuration test failed"
    exit 1
fi

# Allow port 443 in firewall
sudo ufw allow 443/tcp
sudo ufw reload

echo "✅ HTTPS configuration complete!"
echo "Test with: curl https://api.grahmind.com/api/health"


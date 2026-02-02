#!/bin/bash

echo "🔍 DEBUGGING CONNECTION..."
echo "=========================="

echo "1. Checking if Backend is listening on Port 5000..."
netstat -tlpn | grep 5000 || echo "❌ NOTHING listening on port 5000!"

echo ""
echo "2. Checking Nginx Error Logs (Last 20 lines)..."
# Check standard locations
if [ -f /var/log/nginx/error.log ]; then
    tail -n 20 /var/log/nginx/error.log
else
    echo "⚠️ Could not find /var/log/nginx/error.log"
fi

echo ""
echo "3. Testing Local Connection (from server to itself)..."
curl -v http://127.0.0.1:5000/api/health
echo ""

echo ""
echo "4. Checking Nginx Config status..."
nginx -t

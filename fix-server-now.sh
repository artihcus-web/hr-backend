#!/bin/bash
# This script will update the server to the latest commit

echo "🔄 Updating /data/backend to latest commit..."
cd /data/backend

echo "📥 Fetching latest code..."
git fetch origin --force

echo "🔄 Resetting to origin/main..."
git reset --hard origin/main

echo "📋 Current commit:"
git log -1 --oneline

echo "✅ Creating/updating .env file..."
cat > .env << 'EOF'
# Docker image
DOCKER_IMAGE=harshava123/hr-backend:latest

# MongoDB
MONGODB_URI=mongodb://admin:Artihcus%40123@localhost:27017/myapp?authSource=admin

# Server
PORT=5000
NODE_ENV=production

# JWT Secret
JWT_SECRET=my-super-secret-key-12345-change-this

# Frontend URL
FRONTEND_URL=https://fer-henna-omega.vercel.app

# Email Configuration (for timesheet notifications)
EMAIL_USER=Artihcusweb@gmail.com
EMAIL_PASSWORD=zhiu altz yojv nesc
EOF

echo "🐳 Pulling latest Docker image..."
docker pull harshava123/hr-backend:latest

echo "🔄 Restarting containers..."
if command -v docker-compose &> /dev/null; then
    docker-compose down
    docker-compose up -d
else
    docker compose down
    docker compose up -d
fi

echo "📋 Container status:"
if command -v docker-compose &> /dev/null; then
    docker-compose ps
else
    docker compose ps
fi

echo "📋 Recent logs:"
if command -v docker-compose &> /dev/null; then
    docker-compose logs --tail=20 backend
else
    docker compose logs --tail=20 backend
fi

echo "✅ Update complete!"


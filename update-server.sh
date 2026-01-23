#!/bin/bash
set -e

echo "=========================================="
echo "🚀 UPDATING SERVER"
echo "=========================================="

cd /data/backend

echo "📥 Fetching latest code..."
git fetch origin --force

echo "🔄 Resetting to origin/main..."
git reset --hard origin/main

echo "📋 Current commit:"
git log -1 --oneline

echo ""
echo "📝 Creating/updating .env file..."
# Check if .env exists, if not create it, if yes update it
if [ ! -f .env ]; then
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
# Set these values or they will use defaults
EMAIL_USER=Artihcusweb@gmail.com
EMAIL_PASSWORD=zhiu altz yojv nesc
EOF
else
  # Update existing .env, add email vars if not present
  if ! grep -q "EMAIL_USER" .env; then
    echo "" >> .env
    echo "# Email Configuration (for timesheet notifications)" >> .env
    echo "EMAIL_USER=Artihcusweb@gmail.com" >> .env
    echo "EMAIL_PASSWORD=zhiu altz yojv nesc" >> .env
  fi
fi

echo "✅ .env file created"

echo ""
echo "🐳 Pulling latest Docker image..."
docker pull harshava123/hr-backend:latest

echo ""
echo "🛑 Stopping old container..."
docker-compose down

echo ""
echo "🚀 Starting new container..."
docker-compose up -d

sleep 5

echo ""
echo "📊 Container status:"
docker-compose ps

echo ""
echo "📋 Recent logs:"
docker-compose logs --tail=30 backend

echo ""
echo "✅ UPDATE COMPLETE!"
echo ""
echo "Test the API:"
echo "curl http://localhost:5000/api/health"


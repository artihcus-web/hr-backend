#!/bin/bash
# Server Setup Script
# Run this on your server to set up everything

set -e

echo "🚀 Starting server setup..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "⚠️  Please run as root or with sudo"
  exit 1
fi

# Create directory
echo "📁 Creating /data/backend directory..."
mkdir -p /data/backend
cd /data/backend

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker first."
  exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
  echo "📦 Installing Docker Compose..."
  curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
fi

# Check if MongoDB is running
if ! systemctl is-active --quiet mongod; then
  echo "⚠️  MongoDB is not running. Starting MongoDB..."
  systemctl start mongod
  systemctl enable mongod
fi

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 22/tcp
ufw allow 5000/tcp
ufw --force enable

# Check if .env exists
if [ ! -f .env ]; then
  echo "📝 Creating .env file..."
  cat > .env << EOF
MONGODB_URI=mongodb://localhost:27017/myapp
PORT=5000
JWT_SECRET=$(openssl rand -base64 32)
FRONTEND_URL=https://your-app.vercel.app
EOF
  echo "✅ .env file created. Please edit it with your settings:"
  echo "   nano /data/backend/.env"
fi

# Make deploy script executable
if [ -f deploy.sh ]; then
  chmod +x deploy.sh
fi

echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file: nano /data/backend/.env"
echo "2. Upload your backend files to /data/backend"
echo "3. Run: cd /data/backend && ./deploy.sh"
echo ""
echo "Or deploy manually:"
echo "   cd /data/backend"
echo "   docker-compose up -d --build"


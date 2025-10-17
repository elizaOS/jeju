#!/bin/bash

# VibeVM TypeScript Edition - Local Development Startup Script

set -e

echo "🚀 Starting VibeVM TypeScript Edition locally..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your configuration"
    exit 1
fi

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20+"
    exit 1
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker"
    exit 1
fi

echo "📦 Installing dependencies..."

# Install auth service dependencies
cd caliguland-auth
if [ ! -d "node_modules" ]; then
    echo "Installing caliguland-auth dependencies..."
    npm install
fi
cd ..

# Install game service dependencies
cd caliguland-game
if [ ! -d "node_modules" ]; then
    echo "Installing caliguland-game dependencies..."
    npm install
fi
cd ..

echo "🏗️  Building services..."

# Build auth service
cd caliguland-auth
npm run build
cd ..

# Build game service
cd caliguland-game
npm run build
cd ..

echo "🐳 Starting Docker services..."

# Start services with docker-compose
docker-compose up --build -d

echo ""
echo "✅ VibeVM is starting up!"
echo ""
echo "📍 Access points:"
echo "   - Main UI: http://localhost:8080"
echo "   - Login: http://localhost:8080/login"
echo "   - Game UI: http://localhost:8080/game"
echo "   - Game API: http://localhost:8000/api/v1/docs"
echo ""
echo "📊 Check status:"
echo "   docker-compose ps"
echo ""
echo "📜 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose down"
echo ""


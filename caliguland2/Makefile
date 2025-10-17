# VibeVM TypeScript Edition - Makefile

.PHONY: help install build dev start stop clean test

help:
	@echo "VibeVM TypeScript Edition - Available Commands:"
	@echo ""
	@echo "  make install    - Install all dependencies"
	@echo "  make build      - Build TypeScript services"
	@echo "  make dev        - Run in development mode"
	@echo "  make start      - Start all services with Docker"
	@echo "  make stop       - Stop all services"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make test       - Run tests"
	@echo "  make logs       - View service logs"
	@echo ""

install:
	@echo "📦 Installing dependencies..."
	@cd caliguland-auth && npm install
	@cd caliguland-game && npm install
	@cd examples && npm install
	@echo "✅ Dependencies installed"

build:
	@echo "🏗️  Building services..."
	@cd caliguland-auth && npm run build
	@cd caliguland-game && npm run build
	@echo "✅ Build complete"

dev:
	@echo "🚀 Starting development servers..."
	@echo "Open these in separate terminals:"
	@echo "  Terminal 1: cd caliguland-auth && npm run dev"
	@echo "  Terminal 2: cd caliguland-game && npm run dev"
	@echo "  Terminal 3: docker-compose up caliguland-gateway aio-sandbox"

start:
	@echo "🐳 Starting all services with Docker..."
	@docker-compose up --build -d
	@echo ""
	@echo "✅ Services started!"
	@echo ""
	@echo "📍 Access points:"
	@echo "   - Main UI: http://localhost:8080"
	@echo "   - Login: http://localhost:8080/login"
	@echo "   - Game: http://localhost:8080/game"
	@echo "   - Game API: http://localhost:8000/api/v1/docs"
	@echo ""
	@echo "Run 'make logs' to view logs"

stop:
	@echo "🛑 Stopping all services..."
	@docker-compose down
	@echo "✅ Services stopped"

clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf caliguland-auth/dist caliguland-auth/node_modules
	@rm -rf caliguland-game/dist caliguland-game/node_modules
	@rm -rf examples/node_modules
	@docker-compose down -v
	@echo "✅ Cleaned"

test:
	@echo "🧪 Running tests..."
	@cd caliguland-game && npm test || echo "No tests configured yet"

logs:
	@docker-compose logs -f

status:
	@docker-compose ps

restart:
	@make stop
	@make start

# Development helpers
dev-auth:
	@cd caliguland-auth && npm run dev

dev-game:
	@cd caliguland-game && npm run dev

dev-agent:
	@cd examples && npm run simple-agent

# Production helpers
prod-build:
	@docker build -t caliguland-auth:latest ./caliguland-auth
	@docker build -t caliguland-game:latest ./caliguland-game
	@docker build -t caliguland-gateway:latest ./caliguland-gateway
	@echo "✅ Production images built"

prod-push:
	@echo "🚀 Pushing to registry..."
	@docker tag caliguland-auth:latest your-registry/caliguland-auth:latest
	@docker tag caliguland-game:latest your-registry/caliguland-game:latest
	@docker tag caliguland-gateway:latest your-registry/caliguland-gateway:latest
	@docker push your-registry/caliguland-auth:latest
	@docker push your-registry/caliguland-game:latest
	@docker push your-registry/caliguland-gateway:latest
	@echo "✅ Images pushed"


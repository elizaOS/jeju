#!/bin/bash

# VibeVM Setup Verification Script

echo "🔍 Verifying VibeVM TypeScript setup..."
echo ""

ERRORS=0

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ $NODE_VERSION"
else
    echo "❌ Not found"
    ERRORS=$((ERRORS + 1))
fi

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ v$NPM_VERSION"
else
    echo "❌ Not found"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker
echo -n "Checking Docker... "
if command -v docker &> /dev/null; then
    echo "✅ $(docker --version)"
else
    echo "❌ Not found"
    ERRORS=$((ERRORS + 1))
fi

# Check docker-compose
echo -n "Checking docker-compose... "
if command -v docker-compose &> /dev/null; then
    echo "✅ $(docker-compose --version)"
else
    echo "❌ Not found"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "📁 Checking project structure..."

# Check directories
DIRS=(
    "caliguland-auth"
    "caliguland-auth/src"
    "caliguland-game"
    "caliguland-game/src"
    "caliguland-game/src/game"
    "caliguland-game/src/api"
    "caliguland-game/src/public"
    "caliguland-gateway"
    "examples"
)

for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "  ✅ $dir/"
    else
        echo "  ❌ $dir/ - Missing"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
echo "📄 Checking key files..."

# Check files
FILES=(
    "docker-compose.yaml"
    "caliguland-auth/package.json"
    "caliguland-auth/tsconfig.json"
    "caliguland-auth/Dockerfile"
    "caliguland-auth/src/index.ts"
    "caliguland-game/package.json"
    "caliguland-game/tsconfig.json"
    "caliguland-game/Dockerfile"
    "caliguland-game/src/index.ts"
    "caliguland-game/src/types.ts"
    "caliguland-game/src/game/engine.ts"
    "caliguland-game/src/game/scenarios.ts"
    "caliguland-game/src/api/routes.ts"
    "caliguland-game/src/public/index.html"
    "caliguland-gateway/nginx.conf"
    "caliguland-gateway/Dockerfile"
    "examples/simple-agent.ts"
    "Makefile"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file - Missing"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
echo "🔧 Checking TypeScript compilation..."

# Check auth compilation
echo -n "  Auth service... "
cd caliguland-auth 2>/dev/null
if [ -f "package.json" ]; then
    if [ -d "node_modules" ]; then
        if npx tsc --noEmit 2>/dev/null; then
            echo "✅"
        else
            echo "⚠️  TypeScript errors (run 'npm install' if needed)"
        fi
    else
        echo "⏸️  Dependencies not installed (run 'npm install')"
    fi
else
    echo "❌ package.json not found"
    ERRORS=$((ERRORS + 1))
fi
cd - > /dev/null

# Check game compilation
echo -n "  Game service... "
cd caliguland-game 2>/dev/null
if [ -f "package.json" ]; then
    if [ -d "node_modules" ]; then
        if npx tsc --noEmit 2>/dev/null; then
            echo "✅"
        else
            echo "⚠️  TypeScript errors (run 'npm install' if needed)"
        fi
    else
        echo "⏸️  Dependencies not installed (run 'npm install')"
    fi
else
    echo "❌ package.json not found"
    ERRORS=$((ERRORS + 1))
fi
cd - > /dev/null

echo ""
echo "📚 Documentation check..."

DOCS=(
    "README.md"
    "README_TYPESCRIPT.md"
    "QUICKSTART_TYPESCRIPT.md"
    "MIGRATION_GUIDE.md"
    "caliguland-game/GAME_DESIGN.md"
    "SETUP_COMPLETE.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo "  ✅ $doc"
    else
        echo "  ❌ $doc - Missing"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""
echo "═══════════════════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
    echo "✅ Setup verification PASSED!"
    echo ""
    echo "🚀 Ready to start:"
    echo "   make start        # Start all services"
    echo "   make install      # Install dependencies"
    echo "   ./start-local.sh  # Quick start script"
    echo ""
else
    echo "⚠️  Setup verification found $ERRORS issue(s)"
    echo ""
    echo "💡 To fix:"
    echo "   1. Install missing tools (Node.js, Docker)"
    echo "   2. Run: make install"
    echo "   3. Run this script again"
    echo ""
fi
echo "═══════════════════════════════════════════════"


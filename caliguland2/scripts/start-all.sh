#!/bin/bash
# VibeVM - Complete Stack Startup
# Starts game server, contracts, and agents for E2E testing

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎮 VibeVM Prediction Game - Full Stack Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Environment defaults
export GAME_DURATION_MS="${GAME_DURATION_MS:-600000}"  # 10 min for testing
export MIN_PLAYERS="${MIN_PLAYERS:-5}"
export MAX_PLAYERS="${MAX_PLAYERS:-20}"
export AUTO_SHUTDOWN_MS="${AUTO_SHUTDOWN_MS:-120000}"  # 2 min default

# Check Anvil
if ! lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null ; then
    echo "🔨 Starting Anvil blockchain..."
    anvil > /dev/null 2>&1 &
    ANVIL_PID=$!
    sleep 3
    echo "✅ Anvil started (PID: $ANVIL_PID)"
else
    echo "✅ Anvil already running"
fi

# Build
echo ""
echo "🛠️  Building TypeScript..."
cd caliguland-game
npm run build > /dev/null 2>&1
cd ../caliguland-auth
npm run build > /dev/null 2>&1
cd ..

# Deploy contracts
if [ -f "contracts/foundry.toml" ]; then
    echo ""
    echo "📝 Deploying contracts..."
    cd contracts
    forge install > /dev/null 2>&1 || true
    forge build > /dev/null 2>&1
    # TODO: Add deployment script
    cd ..
fi

# Start game server
echo ""
echo "🎮 Starting game server..."
cd caliguland-game
PORT=8000 GAME_DURATION_MS=$GAME_DURATION_MS MIN_PLAYERS=$MIN_PLAYERS \
  bun run dist/index.js > ../logs/game.log 2>&1 &
GAME_PID=$!
cd ..

# Wait for health
printf "⏳ Waiting for game server"
for i in {1..60}; do
  if curl -sSf http://localhost:8000/health >/dev/null 2>&1; then
    echo "\n✅ Game server ready"
    break
  fi
  printf "."
  sleep 0.5
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ System Running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Access:"
echo "   Game:       http://localhost:8000/game"
echo "   Agent Card: http://localhost:8000/.well-known/agent-card.json"
echo "   Health:     http://localhost:8000/health"
echo ""
echo "PIDs: game=$GAME_PID"
echo ""
echo "Press Ctrl+C to stop"

trap "echo '\n🛑 Stopping...'; kill $GAME_PID 2>/dev/null; exit" INT TERM
wait

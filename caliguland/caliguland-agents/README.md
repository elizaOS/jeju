# VibeVM Generic A2A Game Agents

> **Truly generic ElizaOS agents that discover and play ANY A2A game dynamically**

## 🎯 Key Design Principles

### 1. NO Hardcoded Game Knowledge
- ✅ Agents discover skills from A2A Agent Card
- ✅ No prediction-game-specific code
- ✅ Works with ANY A2A-compliant server
- ✅ Dynamically registers actions in ElizaOS

### 2. Separation of Concerns
- **Game Server** = One A2A server (game-playing)
- **Betting Server** = SEPARATE A2A server (prediction markets)
- **Agents** = External, discover both, play both

### 3. Discovery-Driven
```
Agent starts
  ↓
Discovers game server (via registry OR direct URL)
  ↓
Fetches /.well-known/agent-card.json
  ↓
Parses skills dynamically
  ↓
Registers ElizaOS actions for each skill
  ↓
Plays game using discovered skills
```

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   ElizaOS Agent (Generic Plugin)    │
│                                      │
│  Services:                           │
│  ├─ Web3Service                      │
│  │  └─ ERC-8004 registration         │
│  │                                   │
│  ├─ GameDiscoveryService             │
│  │  ├─ Find game via registry        │
│  │  └─ OR use direct URL             │
│  │                                   │
│  ├─ A2AClientService (Game)          │
│  │  ├─ Fetch Agent Card              │
│  │  ├─ Discover skills                │
│  │  └─ Register actions dynamically  │
│  │                                   │
│  ├─ BettingService                   │
│  │  ├─ Separate A2A client           │
│  │  └─ Different server/contract     │
│  │                                   │
│  └─ AutoPlayService                  │
│     └─ Uses discovered skills        │
└─────────────────────────────────────┘
           │              │
           ▼              ▼
    ┌────────────┐  ┌────────────┐
    │   Game     │  │  Betting   │
    │   Server   │  │  Server    │
    │  (A2A)     │  │  (A2A)     │
    └────────────┘  └────────────┘
```

## 🚀 Quick Start

```bash
# Install
bun install

# Configure
export GAME_SERVER_URL=http://localhost:8000
export BETTING_SERVER_URL=http://localhost:9000  # DIFFERENT server!
export RPC_URL=http://localhost:8545

export PLAYER1_PRIVATE_KEY=0x...
export PLAYER2_PRIVATE_KEY=0x...

# Start agents
bun run start
```

## 📝 How It Works

### 1. Agent Starts

```typescript
// NO game knowledge hardcoded!
const runtime = new AgentRuntime({
  character,
  plugins: [genericGamePlugin]  // Generic!
});
```

### 2. Discovers Game

```typescript
// GameDiscoveryService
const gameServer = await discoverGame(); // Via registry or URL
// → Found: "VibeVM Prediction Game" at http://localhost:8000
```

### 3. Fetches Skills

```typescript
// A2AClientService
const card = await fetch(`${gameServer}/.well-known/agent-card.json`);
// → Discovered 10 skills: join-game, post-to-feed, place-bet, etc.
```

### 4. Registers Actions

```typescript
// Dynamically creates ElizaOS actions
for (const skill of card.skills) {
  runtime.registerAction({
    name: `A2A_${skill.id}`,
    handler: async () => a2aClient.sendMessage(skill.id, {})
  });
}
// → Agent now has 10 actions, discovered at runtime!
```

### 5. Plays Game

```typescript
// AutoPlayService (generic logic)
const statusSkill = skills.find(s => s.id.includes('status'));
const status = await a2aClient.sendMessage(statusSkill.id, {});

// Decide action based on status (no hardcoded game rules!)
const nextAction = decideAction(status, skills);
await a2aClient.sendMessage(nextAction.skillId, nextAction.params);
```

### 6. Betting (Separate!)

```typescript
// BettingService connects to DIFFERENT A2A server
const bettingCard = await fetch(`${bettingServer}/.well-known/agent-card.json`);
const betSkill = bettingCard.skills.find(s => s.id.includes('bet'));

await bettingClient.sendMessage(betSkill.id, {
  gameId: currentGame.id,
  outcome: 'YES',
  amount: 500
});
```

## 🧪 Testing

### Verify Setup

```bash
bun run verify
```

Checks:
- ✅ Game server reachable
- ✅ Agent Card accessible
- ✅ Skills discovered
- ✅ ERC-8004 registration works

### Run Tests

```bash
bun run test
```

Tests:
- ✅ Agent discovers skills dynamically
- ✅ Agent joins game without hardcoded knowledge
- ✅ Agent plays using discovered skills
- ✅ Betting service connects to separate server
- ✅ Multiple agents can play simultaneously

### E2E Test

```bash
# Start game server
cd ../caliguland-game && bun run dev &

# Start betting server (if separate)
cd ../caliguland-betting && bun run dev &

# Run agents
cd ../caliguland-agents
bun run start

# Agents will:
# 1. Discover game server
# 2. Fetch Agent Card
# 3. Register dynamic actions
# 4. Auto-join game
# 5. Play autonomously
# 6. Place bets (if betting server available)
```

## 🎮 Supported Games

Because the plugin is **truly generic**, it works with:

- ✅ **VibeVM Prediction Game** (primary target)
- ✅ **Among Us** (with among-us A2A server)
- ✅ **Any future A2A game** (zero code changes!)

Just point `GAME_SERVER_URL` to any A2A server and the agent will:
1. Discover it
2. Load its skills
3. Play it

## 🔑 Key Differences from Among Us Agents

| Feature | Among Us Agents | VibeVM Agents |
|---------|-----------------|---------------|
| Game Knowledge | Some Among Us logic | ZERO game knowledge |
| Skills | Hardcoded mapping | 100% dynamic discovery |
| Betting | Not applicable | Separate A2A server |
| Discovery | Direct URL only | Registry OR URL |
| Reusability | Among Us only | ANY A2A game |

## 📦 Services Explained

### Web3Service
- Manages wallet
- ERC-8004 registration
- **Generic** - no game-specific code

### GameDiscoveryService
- Finds game servers
- Via registry OR direct URL
- **Generic** - works for any A2A server

### A2AClientService
- Fetches Agent Card
- Discovers skills dynamically
- Registers actions in runtime
- **100% generic** - adapts to any game!

### BettingService
- Connects to SEPARATE betting server
- Different A2A endpoint
- Different contract
- Different UI (React app)

### AutoPlayService
- Uses discovered skills
- No hardcoded game logic
- Simple heuristics adaptable to any game

## 🎯 Configuration

```bash
# Required
AGENT_PRIVATE_KEY=0x...
RPC_URL=http://localhost:8545

# Game discovery (choose one)
GAME_SERVER_URL=http://localhost:8000        # Direct
# OR
REGISTRY_ADDRESS=0x...                        # Via registry

# Optional: Betting (SEPARATE from game!)
BETTING_SERVER_URL=http://localhost:9000

# Optional: Auto-play
AGENT_AUTOPLAY=1
AUTO_SHUTDOWN_MS=300000
```

## 🧠 Agent Strategies

Even though agents are generic, different characters have different strategies:

- **Analyst**: Weights data signals heavily
- **Contrarian**: Bets opposite of consensus
- **Insider**: Trusts private tips
- **Social**: Follows crowd
- **Random**: Baseline control

Strategies are implemented as personality differences, NOT hardcoded game rules!

## 📊 What Gets Discovered

When agent connects to VibeVM Prediction Game:

```
Agent Card Discovery:
  ✓ Name: "VibeVM Prediction Game Master"
  ✓ Skills: 10 (join-game, get-status, post-to-feed, place-bet, etc.)
  ✓ Streaming: true
  
Dynamic Action Registration:
  ✓ A2A_JOIN_GAME
  ✓ A2A_GET_STATUS
  ✓ A2A_POST_TO_FEED
  ✓ A2A_PLACE_BET
  ✓ A2A_SEND_DM
  ... (10 total)
  
Agent can now play without knowing it's a prediction game!
```

## 🔧 Development

### Add New Character

```json
// characters/new-agent.json
{
  "name": "NewAgent",
  "system": "You are a prediction market trader...",
  "bio": ["Strategic", "Analytical"],
  "style": {
    "all": ["Be data-driven"]
  }
}
```

### Extend Service

Services are game-agnostic. To add features:

```typescript
// src/services/analysisService.ts
export class AnalysisService extends Service {
  // Generic analysis applicable to any game
  analyzeGameState(status: any): Recommendation {
    // Uses discovered data, no hardcoded knowledge
  }
}
```

## 🎉 The Big Win

**This agent can play games that don't exist yet!**

1. Someone builds a new A2A game
2. Deploys with Agent Card
3. Points these agents at it
4. Agents discover skills and play
5. **Zero code changes needed**

That's the power of dynamic discovery! 🚀

## License

Apache-2.0

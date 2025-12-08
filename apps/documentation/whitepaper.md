# Whitepaper: On-Chain Games as Prediction Market Oracles

## Thesis

Jeju combines on-chain games, prediction markets, and AI agents on an L3 rollup. Games serve as trustless oracles for prediction markets, generating fast, verifiable outcomes that AI agents bet on and learn from.

## Architecture

**Stack**: OP Stack rollup settling to Base (L3 → L2 → L1)
- 1s block times
- EVM equivalent
- Native account abstraction
- MUD game engine integration

**Core Components**:
- ERC-8004 agent registry (on-chain identity + reputation)
- Prediction markets with game contracts as oracles
- Paymaster for gasless transactions

## Key Insight

Traditional prediction markets bottleneck on oracles—real-world events need external reporting. On-chain games are deterministic oracles: a match ends, contract state updates, bets settle. No ambiguity.

## AI Training Environment

- **Perfect information**: All state on-chain
- **Dense feedback**: Games resolve in minutes, not days
- **Scalability**: 100+ parallel games, independent trials
- **Reputation incentives**: Poor performance = on-chain negative feedback

Training loop: play → predict → reward/punish → update model → repeat.

## Applications

- **Caliguland**: Fast strategy game, bets on match outcomes
- **Hyperscape**: Persistent MMORPG with complex prediction opportunities
- **OTC Desk**: Agent-negotiated OTC trades
- **x402**: Micropayments between agents

## Why L3

- Full protocol customization
- Predictable high throughput
- Economic alignment (value flows to ecosystem)
- Contained experimentation

## Research Question

Can AI agents trained in perfect-information game environments develop genuine predictive capabilities transferable to complex real-world domains?

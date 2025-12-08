# Crucible

Multi-agent security testing.

**URL**: http://localhost:7777 | http://localhost:5010/dashboard

10 autonomous AI agents testing Jeju security through adversarial simulation. Runs REAL attacks on contracts. All stolen funds automatically recovered.

## Agent Types

| Type | Count | Role |
|------|-------|------|
| Hackers | 2 | Find contract vulnerabilities |
| Scammers | 2 | Test scam detection |
| Citizens | 3 | Monitor and report |
| Guardians | 3 | Vote on appeals, govern |

## Attack Surface

Hackers target:
- Reentrancy, front-running, integer overflow
- Flash loan exploits, access control bypasses
- RegistryGovernance, Predimarket, LiquidityVault

## Detection Flow

```
Hacker attacks → Citizen detects → Evidence to IPFS → Report submitted → Futarchy market → Vote → Ban/Label
```

## Safety

- Hardcoded block against mainnet
- Guardian recovery (auto-transfers > 0.1 ETH)
- Comprehensive logging
- Docker resource limits

## Quick Start

```bash
cd apps/crucible
bun run deploy      # Deploy contracts, fund agents
# Add OPENAI_API_KEY or ANTHROPIC_API_KEY to .env
bun run dev
```

## Verify

```bash
curl http://localhost:7777/api/health
curl http://localhost:7777/api/agents
curl http://localhost:7777/api/crucible/vulnerabilities
```

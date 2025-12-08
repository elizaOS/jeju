---
layout: home

hero:
  name: Jeju
  text: L3 on Base
  tagline: OP-Stack with 200ms Flashblocks, settling on Base.
  image:
    src: /logo.svg
    alt: Jeju
  actions:
    - theme: brand
      text: Quick Start
      link: /getting-started/quick-start
    - theme: alt
      text: GitHub
      link: https://github.com/elizaos/jeju

features:
  - icon: ⚡
    title: 200ms Blocks
    details: Flashblocks for instant confirmation.
  
  - icon: 💸
    title: L3 Costs
    details: 10-100x cheaper than Base.
  
  - icon: 🔒
    title: Ethereum Security
    details: Fraud proofs through Base → Ethereum.
  
  - icon: 📦
    title: EigenDA
    details: Data availability with calldata fallback.
---

## Stack

```
Ethereum L1 ← Base ← Jeju
```

## Networks

| Network | Chain ID | RPC |
|---------|----------|-----|
| Testnet | 420690 | https://testnet-rpc.jeju.network |
| Mainnet | 420691 | https://rpc.jeju.network |

## Applications

| App | Purpose |
|-----|---------|
| [Bazaar](/applications/bazaar) | DeFi + NFT + Prediction Markets |
| [Gateway](/applications/gateway) | Bridge, Paymasters, Node Staking |
| [Crucible](/applications/crucible) | AI Security Testing |

## Links

- [Discord](https://discord.gg/jeju)
- [GitHub](https://github.com/elizaos/jeju)
- [Explorer](https://explorer.jeju.network)

<style>
.info-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 1.5rem;
}
.info-card h3 { margin-top: 0; }
.network-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  margin: 2rem 0;
}
</style>

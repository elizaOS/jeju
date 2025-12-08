# Uniswap V4 Mainnet Deployment

Network: Jeju Mainnet (420691)  
Time: 2-4 hours  
Risk: High

## Pre-requisites

- [ ] 4+ weeks stable on testnet
- [ ] Security audit (if custom hooks)
- [ ] Bug bounty live
- [ ] 24/7 on-call team (3+ engineers)
- [ ] Hardware wallet for deployment
- [ ] 2-3 ETH on deployer

## Phase 1: Prep

```bash
cd contracts
git pull && git submodule update --init --recursive
forge build --use 0.8.26
forge test
```

**24h before**: Test full deployment on mainnet fork
```bash
anvil --fork-url https://rpc.jeju.network
bun run scripts/deploy-uniswap-v4.ts  # Against fork
```

## Phase 2: Deploy

**Team requirements**: 3+ engineers on call, screen sharing, recording

```bash
export JEJU_NETWORK="mainnet"
export JEJU_RPC_URL="https://rpc.jeju.network"
export PRIVATE_KEY=$(cat .mainnet-deployer-key)

echo "Deployer: $(cast wallet address --private-key $PRIVATE_KEY)"
echo "Press Ctrl+C to abort..." && sleep 10

bun run scripts/deploy-uniswap-v4.ts
```

**Immediately after:**
```bash
bun run scripts/verify-uniswap-v4-deployment.ts --network mainnet --verbose
cast call $POOL_MANAGER "owner()" --rpc-url https://rpc.jeju.network
```

## Phase 3: Post-Deploy

- [ ] Save deployment backup
- [ ] Transfer ownership to multisig (optional but recommended)
- [ ] Set up monitoring (Tenderly/OpenZeppelin Defender)
- [ ] Update documentation with address
- [ ] Announce deployment

## Emergency

PoolManager is immutable. If critical issue:
- Deploy new PoolManager
- Coordinate pool migration
- Compensate LPs if needed

## Success Criteria

- [ ] Deployment verified
- [ ] Monitoring active
- [ ] Team confident
- [ ] No security incidents (24h)

# Support

## Quick Links

| Channel | Use For |
|---------|---------|
| [Discord](https://discord.gg/jeju) | Real-time help |
| [GitHub](https://github.com/elizaos/jeju) | Bug reports, code |
| security@jeju.network | Security issues |
| enterprise@jeju.network | Enterprise support |

## Common Issues

### Setup

```bash
# Bun not found
curl -fsSL https://bun.sh/install | bash && source ~/.bashrc

# Docker not running
sudo systemctl start docker  # Linux
open -a Docker               # macOS

# Kurtosis enclave fails
kurtosis clean -a && bun run dev
```

### Network

**Can't connect to RPC**:
- Primary: `https://testnet-rpc.jeju.network`
- Check status: https://status.jeju.network

**Transaction stuck**:
1. Check on explorer
2. Increase gas and resend with same nonce

**Need testnet ETH**:
- Faucet: https://faucet.jeju.network
- Or ask in Discord #testnet-faucet

### Bridge

**Deposit not received**: Wait 2-5 minutes, check both explorers

**Withdrawal slow**: Standard = 7 days. Use Hop/Across for fast (~15 min + fee)

### Development

```bash
# Check balance
cast balance $ADDRESS --rpc-url https://testnet-rpc.jeju.network

# Contract verification
forge verify-contract --chain-id 420690 $ADDRESS src/Contract.sol:Contract
```

## Status

https://status.jeju.network

## Bug Bounty

https://immunefi.com/bounty/jeju

| Severity | Range |
|----------|-------|
| Critical | $100k - $1M |
| High | $10k - $100k |
| Medium | $1k - $10k |

## Resources

- Explorer: https://explorer.jeju.network
- Bridge: https://bridge.jeju.network
- Faucet: https://faucet.jeju.network
- RPC: https://rpc.jeju.network
- WebSocket: wss://ws.jeju.network

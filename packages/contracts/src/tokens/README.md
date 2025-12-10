# JejuToken

The native ERC-20 token for Jeju Network with integrated ban enforcement.

## Overview

| Property | Value |
|----------|-------|
| Name | Jeju |
| Symbol | JEJU |
| Decimals | 18 |
| Initial Supply | 1,000,000,000 (1B) |
| Max Supply | 10,000,000,000 (10B) |
| Standard | ERC-20 + Custom Extensions |

## Features

### Ban Enforcement
Integrates with `BanManager` to prevent banned users from transferring tokens:
- Banned senders cannot transfer (blocked at `_update`)
- Banned receivers cannot receive tokens
- **Exception**: Transfers TO ban-exempt addresses (e.g., ModerationMarketplace) are allowed

This exception is critical for allowing banned users to stake tokens to appeal their ban.

### Ban Exemption
```solidity
mapping(address => bool) public banExempt;

function setBanExempt(address account, bool exempt) external onlyOwner;
```

Set the ModerationMarketplace as ban-exempt to enable appeals:
```solidity
jejuToken.setBanExempt(moderationMarketplace, true);
```

### Faucet (Dev/Testnet)
```solidity
uint256 public constant FAUCET_AMOUNT = 10_000 * 10**18; // 10k JEJU
uint256 public constant FAUCET_COOLDOWN = 1 hours;

function faucet() external;                    // Claim to msg.sender
function faucetTo(address recipient) external; // Claim to another address
```

The faucet is enabled on localnet and testnet, disabled on mainnet.

### Minting
```solidity
function mint(address to, uint256 amount) external onlyOwner;
```

Owner can mint up to `MAX_SUPPLY`. Used for treasury allocation, rewards, etc.

## Deployment

### Localnet
```bash
bun run scripts/deploy-jeju-token.ts --network localnet
```

### Testnet (with multi-sig)
```bash
bun run scripts/deploy-jeju-token.ts --network testnet --safe 0x...
```

### Mainnet (requires multi-sig)
```bash
bun run scripts/deploy-jeju-token.ts --network mainnet --safe 0x...
```

### Foundry
```bash
# Basic deployment
forge script script/DeployJejuToken.s.sol:DeployJejuToken --rpc-url $RPC_URL --broadcast

# Full ecosystem (BanManager + TokenRegistry)
forge script script/DeployJejuToken.s.sol:DeployJejuTokenFull --rpc-url $RPC_URL --broadcast
```

## Integration

### Reading Token State
```typescript
import { JejuTokenAbi } from '@jejunetwork/contracts';

const balance = await client.readContract({
  address: JEJU_ADDRESS,
  abi: JejuTokenAbi,
  functionName: 'balanceOf',
  args: [userAddress],
});

const isBanned = await client.readContract({
  address: JEJU_ADDRESS,
  abi: JejuTokenAbi,
  functionName: 'isBanned',
  args: [userAddress],
});
```

### Paymaster Integration
JejuToken works with the multi-token paymaster system. Register in TokenRegistry:
```typescript
await tokenRegistry.registerToken(
  jejuAddress,
  priceOracleAddress,
  0,     // 0% min fee
  200,   // 2% max fee
  bytes32(0)
);
```

### Ban Flow
1. User reported in ModerationMarketplace
2. If vote passes, `BanManager.applyAddressBan()` called
3. JejuToken's `_update()` checks `banManager.isAddressBanned()`
4. Banned user can still transfer TO ModerationMarketplace to appeal

## Security

### Multi-Sig Ownership
For production deployments, ownership should be transferred to a Safe multi-sig:
```solidity
jejuToken.transferOwnership(safeAddress);
banManager.transferOwnership(safeAddress);
```

### Critical Functions (Owner Only)
- `mint()` - Create new tokens
- `setBanManager()` - Change ban enforcement source
- `setBanEnforcement()` - Toggle ban enforcement
- `setBanExempt()` - Set ban exemption for addresses
- `setFaucetEnabled()` - Toggle faucet

### External Dependencies
- `BanManager`: Trusted external call in `_update()`
- Malicious BanManager could DOS the token

## Events

| Event | Parameters |
|-------|------------|
| `BanManagerUpdated` | oldManager, newManager |
| `BanEnforcementToggled` | enabled |
| `BanExemptUpdated` | account, exempt |
| `FaucetToggled` | enabled |
| `FaucetClaimed` | claimer, amount |

## Errors

| Error | Description |
|-------|-------------|
| `BannedUser(address)` | Transfer blocked due to ban |
| `MaxSupplyExceeded()` | Mint would exceed 10B cap |
| `FaucetDisabled()` | Faucet not enabled |
| `FaucetCooldownActive(nextClaimTime)` | Must wait before claiming again |
| `FaucetInsufficientBalance()` | Owner has insufficient balance |

## Addresses

| Network | JejuToken | BanManager |
|---------|-----------|------------|
| Localnet | Deployed on demand | Deployed with token |
| Testnet | TBD | TBD |
| Mainnet | TBD | TBD |

## License

MIT

# JejuToken Deployment Runbook

Step-by-step guide for deploying JejuToken across all environments.

## Prerequisites

### Tools
- [Bun](https://bun.sh/) v1.0+
- [Foundry](https://getfoundry.sh/) latest
- Access to network RPC endpoint
- Deployer wallet with sufficient ETH

### For Production
- Safe (Gnosis Safe) multi-sig wallet deployed
- At least 2/3 or 3/5 signers configured
- Hardware wallet recommended for signers

## Environment Setup

### 1. Build Contracts
```bash
cd packages/contracts
forge build
```

### 2. Set Environment Variables
```bash
# Required for testnet/mainnet
export PRIVATE_KEY="0x..."  # Deployer key
export TESTNET_RPC_URL="https://sepolia.base.org"
export MAINNET_RPC_URL="https://mainnet.base.org"

# Optional
export ETHERSCAN_API_KEY="..."  # For verification
```

---

## Localnet Deployment

Quick deployment for local development.

### Step 1: Start Anvil
```bash
anvil
```

### Step 2: Deploy
```bash
bun run scripts/deploy-jeju-token.ts --network localnet
```

### Step 3: Verify
```bash
# Check deployment
cast call <JEJU_ADDRESS> "name()(string)" --rpc-url http://localhost:8545
# Returns: "Jeju"

# Test faucet
cast send <JEJU_ADDRESS> "faucet()" --rpc-url http://localhost:8545 --private-key 0xac09...
```

### Output
- `deployments/localnet/jeju-token.json` - Deployment details
- `deployments/localnet/deployment.json` - Updated with token address

---

## Testnet Deployment

### Step 1: Create Safe Multi-Sig (Recommended)

1. Go to [Safe](https://app.safe.global/)
2. Connect to Base Sepolia
3. Create new Safe with 2/3 signers
4. Fund Safe with ETH for gas

### Step 2: Dry Run
```bash
bun run scripts/deploy-jeju-token.ts \
  --network testnet \
  --safe 0x<SAFE_ADDRESS> \
  --dry-run
```

Review output for expected transactions.

### Step 3: Deploy
```bash
bun run scripts/deploy-jeju-token.ts \
  --network testnet \
  --safe 0x<SAFE_ADDRESS>
```

### Step 4: Verify Contracts
```bash
cd packages/contracts
forge verify-contract <JEJU_ADDRESS> JejuToken \
  --chain-id 84532 \
  --watch
```

### Step 5: Post-Deployment
1. **Set Ban Exemption** (if ModerationMarketplace exists):
   ```bash
   # Via Safe UI, execute:
   jejuToken.setBanExempt(moderationMarketplace, true)
   ```

2. **Register in TokenRegistry** (for paymaster):
   ```bash
   # Via Safe UI, execute:
   tokenRegistry.registerToken(jejuAddress, oracleAddress, 0, 200, bytes32(0))
   ```

3. **Update Frontend Config**:
   ```bash
   # apps/gateway/.env
   VITE_JEJU_TOKEN_ADDRESS=0x...
   ```

---

## Mainnet Deployment

⚠️ **REQUIRES SAFE MULTI-SIG** ⚠️

### Pre-Deployment Checklist

- [ ] Safe multi-sig deployed with 3/5 or higher threshold
- [ ] Hardware wallets for all signers
- [ ] Audit completed for JejuToken
- [ ] Testnet deployment verified working
- [ ] Emergency response plan documented
- [ ] Token economics finalized

### Step 1: Create Mainnet Safe

1. Go to [Safe](https://app.safe.global/)
2. Connect to Base Mainnet
3. Create new Safe:
   - **Threshold**: 3/5 minimum
   - **Signers**: Hardware wallets recommended
4. Fund Safe with ~0.5 ETH

### Step 2: Pre-Deploy Verification
```bash
# Dry run
bun run scripts/deploy-jeju-token.ts \
  --network mainnet \
  --safe 0x<SAFE_ADDRESS> \
  --dry-run

# Verify Safe address is correct
cast call 0x<SAFE_ADDRESS> "getOwners()(address[])" --rpc-url $MAINNET_RPC_URL
```

### Step 3: Deploy
```bash
bun run scripts/deploy-jeju-token.ts \
  --network mainnet \
  --safe 0x<SAFE_ADDRESS>
```

**Critical**: Record all transaction hashes!

### Step 4: Verify on Block Explorer
```bash
forge verify-contract <JEJU_ADDRESS> JejuToken \
  --chain-id 8453 \
  --constructor-args $(cast abi-encode "constructor(address,address,bool)" <SAFE> <BAN_MANAGER> false)
```

### Step 5: Post-Deployment Configuration

All configuration requires Safe multi-sig approval.

#### A. Set ModerationMarketplace Ban Exempt
```
Target: <JEJU_ADDRESS>
Function: setBanExempt(address account, bool exempt)
Args: (<MOD_MARKETPLACE>, true)
```

#### B. Register in TokenRegistry
```
Target: <TOKEN_REGISTRY>
Function: registerToken(address token, address oracle, uint16 minFeeBps, uint16 maxFeeBps, bytes32 salt)
Args: (<JEJU_ADDRESS>, <ORACLE>, 0, 200, 0x0)
Value: <REGISTRATION_FEE>
```

#### C. Update All App Configs
```bash
# packages/config/tokens.json
# Update mainnet address

# apps/gateway/.env.production
VITE_JEJU_TOKEN_ADDRESS=0x...

# apps/bazaar/.env.production
NEXT_PUBLIC_JEJU_TOKEN=0x...
```

---

## Post-Deployment Verification

### Contract State Verification
```bash
# Check owner
cast call <JEJU_ADDRESS> "owner()(address)"
# Should return Safe address

# Check ban manager
cast call <JEJU_ADDRESS> "banManager()(address)"

# Check faucet state
cast call <JEJU_ADDRESS> "faucetEnabled()(bool)"
# Mainnet: false, Testnet: true

# Check total supply
cast call <JEJU_ADDRESS> "totalSupply()(uint256)"
# Should be 1000000000000000000000000000 (1B with 18 decimals)
```

### Integration Verification
```bash
# Check ban exemption
cast call <JEJU_ADDRESS> "banExempt(address)(bool)" <MOD_MARKETPLACE>
# Should return true

# Check TokenRegistry
cast call <TOKEN_REGISTRY> "isRegistered(address)(bool)" <JEJU_ADDRESS>
# Should return true
```

---

## Rollback Procedures

### If Deployment Fails Mid-Way

1. **Do NOT retry** immediately
2. Document which transactions succeeded
3. Check Safe for pending transactions
4. Cancel any pending transactions
5. Investigate failure cause
6. Re-deploy if needed (contracts are at new addresses)

### If Critical Bug Found Post-Deployment

1. **Pause** (if pausable):
   ```
   Safe Transaction: jejuToken.pause()
   ```

2. **Disable Faucet** (if needed):
   ```
   Safe Transaction: jejuToken.setFaucetEnabled(false)
   ```

3. **Disable Ban Enforcement** (nuclear option):
   ```
   Safe Transaction: jejuToken.setBanEnforcement(false)
   ```

4. Deploy patched contract
5. Migrate state if possible

---

## Security Contacts

- **Smart Contract Security**: security@jeju.network
- **Incident Response**: incidents@jeju.network

## Appendix: Safe Transaction Templates

### Transfer Ownership
```json
{
  "to": "<JEJU_ADDRESS>",
  "value": "0",
  "data": "<ABI_ENCODED_TRANSFER_OWNERSHIP>",
  "operation": 0
}
```

### Set Ban Exempt
```bash
cast calldata "setBanExempt(address,bool)" <ADDRESS> true
```

### Mint Tokens (Treasury Allocation)
```bash
cast calldata "mint(address,uint256)" <TREASURY> 100000000000000000000000000
```

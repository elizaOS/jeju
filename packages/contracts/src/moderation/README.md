# Moderation System

Decentralized futarchy-based moderation for Jeju Network using JEJU token staking.

## Architecture

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   User      │───▶│ JejuStakingHelper│───▶│ ModerationMarketplace│
│ (any token) │    │  (swap to JEJU)  │    │   (JEJU staking)    │
└─────────────┘    └──────────────────┘    └─────────────────────┘
       │                   │                         │
       ▼                   ▼                         ▼
┌─────────────┐    ┌──────────────┐         ┌───────────────┐
│ USDC/ETH/   │    │  XLP Router  │         │  BanManager   │
│ elizaOS/etc │    │ (token swap) │         │  (bans)       │
└─────────────┘    └──────────────┘         └───────────────┘
                                                    │
                                                    ▼
                                            ┌───────────────┐
                                            │  JejuToken    │
                                            │ (enforcement) │
                                            └───────────────┘
```

## Zero-Friction Staking (Paymastered)

Users can stake with **any paymaster-supported token**:

```solidity
// User has USDC, wants to participate in moderation
JejuStakingHelper helper = JejuStakingHelper(helperAddress);

// Step 1: Swap USDC to JEJU (one tx)
usdc.approve(address(helper), 1000e6);
uint256 jejuAmount = helper.swapToJeju(usdc, 1000e6);

// Step 2: Stake JEJU in ModerationMarketplace (one tx)
jejuToken.approve(address(marketplace), jejuAmount);
marketplace.stakeTokens(jejuAmount);
```

Or stake with ETH:
```solidity
// ETH → JEJU → Stake
uint256 jejuAmount = helper.swapETHToJeju{value: 0.1 ether}();
jejuToken.approve(address(marketplace), jejuAmount);
marketplace.stakeTokens(jejuAmount);
```

## Why JEJU as Underlying Token?

The ModerationMarketplace uses JEJU as its sole staking token for the **Conviction Lock** property:

### Conviction Lock Mechanism

| User State | Can Stake JEJU | Can Withdraw JEJU |
|------------|----------------|-------------------|
| Not Banned | ✅ Yes | ✅ Yes |
| Banned | ✅ Yes (MM is ban-exempt) | ❌ No (JejuToken blocks) |
| Won Appeal | ✅ Yes | ✅ Yes (ban removed first) |

**Why this matters:**
1. **Skin in the Game** - Banned users have tokens locked until appeal resolved
2. **Forces Participation** - Can't just walk away from a ban, must engage
3. **Economic Security** - Bad actors can't quickly withdraw and disappear
4. **Alignment** - Moderation is core network function, should use native token

### Flow Example

```
1. Alice stakes 1000 JEJU to report Bob
2. Bob gets ON_NOTICE status, can challenge by staking
3. If Bob is BANNED:
   - His JEJU stake is LOCKED (can't withdraw due to JejuToken ban enforcement)
   - He must appeal with 10x stake to challenge
4. If Bob wins appeal:
   - BanManager.removeAddressBan() called FIRST
   - Bob can now withdraw his JEJU stake
```

## Contracts

### ModerationMarketplace

The main staking and voting contract.

```solidity
constructor(
    address _banManager,
    address _stakingToken,  // Should be JEJU address
    address _treasury,
    address initialOwner
)
```

**Key Functions:**
- `stake()` - Stake ETH (if stakingToken is address(0))
- `stakeTokens(uint256)` - Stake ERC20 (JEJU)
- `openCase(address, string, bytes32)` - Report a user
- `challengeCase(bytes32)` - Target challenges their ban
- `vote(bytes32, VotePosition)` - Vote on a case
- `resolveCase(bytes32)` - Resolve after voting ends
- `requestReReview(bytes32)` - Appeal with 10x stake

### BanManager

Manages network-wide and app-specific bans.

```solidity
// Apply ban from moderation result
function applyAddressBan(address target, bytes32 caseId, string reason)

// Remove ban (when appeal succeeds)
function removeAddressBan(address target)

// Check ban status
function isAddressBanned(address target) returns (bool)
```

### JejuToken Integration

JejuToken's `_update()` checks BanManager:

```solidity
function _update(address from, address to, uint256 value) internal override {
    if (banEnforcementEnabled && address(banManager) != address(0)) {
        // Allow transfers TO ban-exempt addresses (like ModerationMarketplace)
        bool toExempt = banExempt[to];
        
        if (from != address(0) && !toExempt && banManager.isAddressBanned(from)) {
            revert BannedUser(from);
        }
        if (to != address(0) && banManager.isAddressBanned(to)) {
            revert BannedUser(to);
        }
    }
    super._update(from, to, value);
}
```

## Deployment

### 1. Deploy BanManager
```bash
BAN_MANAGER=$(forge create BanManager --constructor-args $GOVERNANCE $OWNER)
```

### 2. Deploy JejuToken with BanManager
```bash
JEJU=$(forge create JejuToken --constructor-args $OWNER $BAN_MANAGER false)
```

### 3. Deploy ModerationMarketplace with JEJU
```bash
MOD_MARKET=$(forge create ModerationMarketplace --constructor-args $BAN_MANAGER $JEJU $TREASURY $OWNER)
```

### 4. Set ModerationMarketplace as Ban-Exempt
```bash
cast send $JEJU "setBanExempt(address,bool)" $MOD_MARKET true
```

### 5. Authorize ModerationMarketplace in BanManager
```bash
cast send $BAN_MANAGER "setAuthorizedModerator(address,bool)" $MOD_MARKET true
```

## Staking Economics

### Minimum Stakes
- Reporter: 0.1 ETH equivalent in JEJU (reputation-adjusted)
- Challenger: Match reporter stake

### Fee Distribution
- Winner: 90% of loser's stake
- Treasury: 5%
- Market makers: 5%

### Asymmetric Slashing
Failed reporters lose **2x their stake** to discourage frivolous reports.

### Quadratic Voting
Vote weight = sqrt(stake) to reduce whale power.

## Reputation System

Moderators build reputation through successful bans:

| Tier | Score Range | Quorum Required | Stake Discount |
|------|-------------|-----------------|----------------|
| UNTRUSTED | 0-1000 | Cannot report | None |
| LOW | 1001-3000 | 3 users | None |
| MEDIUM | 3001-6000 | 2 users | None |
| HIGH | 6001-8000 | 1 user | 25% |
| TRUSTED | 8001-10000 | 1 user | 50% |

## Contracts

| Contract | Purpose |
|----------|---------|
| `ModerationMarketplace.sol` | Core staking and voting (JEJU only) |
| `JejuStakingHelper.sol` | Swap any token → JEJU for staking |
| `BanManager.sol` | Network-wide ban management |

## Security

### Known Considerations
- BanManager is trusted external call in JejuToken
- ModerationMarketplace must be set as ban-exempt
- ModerationMarketplace must be authorized in BanManager
- Conviction lock only works with JEJU (other tokens can be freely withdrawn)

### Emergency Actions
1. Pause ModerationMarketplace
2. Disable ban enforcement in JejuToken (nuclear option)
3. Remove ModerationMarketplace authorization in BanManager

## License

Apache-2.0

# Prediction Game Oracle Contracts

Smart contracts for VibeVM prediction game with TEE attestation.

## Contracts

### PredictionOracle.sol
**Purpose**: Store game outcomes with TEE proofs

**Features**:
- Outcome commitment at game start
- TEE quote verification
- Winner tracking
- External contract queries

**Usage**:
```solidity
// Your DeFi contract
IPredictionOracle oracle = IPredictionOracle(ORACLE_ADDRESS);

// Check if game finished
(bool outcome, bool finalized) = oracle.getOutcome(gameSessionId);

if (finalized) {
    // Use outcome for settlements
    if (outcome) {
        // YES outcome
    } else {
        // NO outcome
    }
}
```

## Deployment

### Local (Anvil)
```bash
# Terminal 1: Start Anvil
anvil

# Terminal 2: Deploy
forge script script/DeployOracle.s.sol --broadcast --rpc-url http://localhost:8545
```

### Testnet (Base Sepolia)
```bash
forge script script/DeployOracle.s.sol \
  --broadcast \
  --rpc-url https://sepolia.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --verify
```

### Mainnet (Base)
```bash
forge script script/DeployOracle.s.sol \
  --broadcast \
  --rpc-url https://mainnet.base.org \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --verify
```

## Testing

```bash
# Run contract tests
forge test

# Run with gas report
forge test --gas-report

# Run specific test
forge test --match-test testCommitReveal
```

## Integration

The game server calls these contracts:

```typescript
// At game start
const commitment = ethers.keccak256(ethers.solidityPacked(
  ['bool', 'bytes32'],
  [outcome, salt]
));

await oracleContract.commitGame(sessionId, question, commitment);

// At game end
const quote = await dstack.getQuote(outcomeData);

await oracleContract.revealGame(
  sessionId,
  outcome,
  salt,
  quote.quote,
  winnerAddresses,
  totalPayout
);
```

## Verification

Anyone can verify:

```solidity
// Check commitment matches
bytes32 computed = keccak256(abi.encodePacked(outcome, salt));
assert(computed == game.commitment);

// Verify TEE quote (using DstackVerifier)
verifier.verify(game.teeQuote, expectedData);
```

## Gas Costs (Estimated)

| Operation | Gas | USD (at 50 gwei, $3000 ETH) |
|-----------|-----|-----|
| commitGame | ~80,000 | $12 |
| revealGame | ~150,000 | $22.50 |
| getOutcome | ~5,000 (view) | $0 |

## License

Apache-2.0


# Agent Registry (ERC-8004)

On-chain identity, reputation, and validation for AI agents.

## Contracts

| Contract | Path | Purpose |
|----------|------|---------|
| IdentityRegistry | `contracts/src/registry/IdentityRegistry.sol` | ERC-721 agent NFTs |
| ReputationRegistry | `contracts/src/registry/ReputationRegistry.sol` | Feedback/ratings |
| ValidationRegistry | `contracts/src/registry/ValidationRegistry.sol` | Independent verification |

## Quick Start

### Register Agent

```bash
cast send $IDENTITY_REGISTRY \
  "register(string)" "ipfs://QmYourAgentConfig" \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### Set Metadata

```bash
cast send $IDENTITY_REGISTRY \
  "setMetadata(uint256,string,bytes)" 1 "name" $(cast abi-encode "x(string)" "My Agent") \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

## IdentityRegistry API

```solidity
// Register
function register(string calldata tokenURI) returns (uint256 agentId);
function register(string calldata tokenURI, MetadataEntry[] calldata metadata) returns (uint256);

// Metadata
function setMetadata(uint256 agentId, string calldata key, bytes calldata value);
function getMetadata(uint256 agentId, string calldata key) returns (bytes memory);

// Query
function totalAgents() returns (uint256);
function ownerOf(uint256 agentId) returns (address);
```

## ReputationRegistry API

```solidity
// Feedback (requires agent signature for authorization)
function giveFeedback(
    uint256 agentId, uint8 score, bytes32 tag1, bytes32 tag2,
    string calldata fileuri, bytes32 filehash, bytes memory feedbackAuth
);

function revokeFeedback(uint256 agentId, uint64 feedbackIndex);

// Query
function getSummary(uint256 agentId, address[] calldata clients, bytes32 tag1, bytes32 tag2)
    returns (uint64 count, uint8 avgScore);
```

## ValidationRegistry API

```solidity
// Request validation
function validationRequest(
    address validatorAddress, uint256 agentId,
    string calldata requestUri, bytes32 requestHash
);

// Respond (validator only)
function validationResponse(
    bytes32 requestHash, uint8 response,
    string calldata responseUri, bytes32 responseHash, bytes32 tag
);

// Query
function getValidationStatus(bytes32 requestHash) returns (
    address validator, uint256 agentId, uint8 response, bytes32 tag, uint256 lastUpdate
);
```

## Revenue Integration

```solidity
// Register + set revenue wallet
uint256 agentId = identityRegistry.register("ipfs://config");
identityRegistry.setMetadata(agentId, "revenueWallet", abi.encode(wallet));

// Deploy app pointing to wallet → users pay via paymaster → you earn 50% of fees
```

## Gas Costs

| Operation | Gas |
|-----------|-----|
| Register | ~75k |
| Register w/ metadata | ~300k |
| Set metadata | ~50k |
| Give feedback | ~150k |
| Validation request | ~120k |

## Testing

```bash
cd contracts
forge test --match-path "test/*Registry*.t.sol" -vv
```

## Web Viewer

```bash
cd contracts/web
python3 -m http.server 3000
# Open http://localhost:3000/registry-viewer.html
```

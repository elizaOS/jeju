# ERC-8004 Agent Registry System

Jeju Network's implementation of the [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) Trustless Agent Registry standard.

## Overview

The ERC-8004 registry system provides a decentralized infrastructure for AI agents to establish identity, build reputation, and get validated. It consists of three core contracts:

1. **IdentityRegistry**: Agent registration and metadata storage (ERC-721 based)
2. **ReputationRegistry**: Feedback and reputation tracking
3. **ValidationRegistry**: Independent validation and verification

## Contracts

### IdentityRegistry.sol

**Purpose**: Register agents as ERC-721 NFTs with on-chain metadata

**Key Features**:
- Each agent is an ERC-721 NFT (transferable, tradeable)
- On-chain key-value metadata storage
- Multiple registration methods (with/without URI and metadata)
- Compatible with all NFT marketplaces and wallets

**Example Usage**:
```solidity
// Register a new agent
uint256 agentId = identityRegistry.register("ipfs://QmYourAgentConfig");

// Set metadata
identityRegistry.setMetadata(agentId, "name", abi.encode("Trading Bot"));
identityRegistry.setMetadata(agentId, "type", abi.encode("defi"));
identityRegistry.setMetadata(agentId, "model", abi.encode("GPT-4"));

// Get metadata
bytes memory nameData = identityRegistry.getMetadata(agentId, "name");
string memory name = abi.decode(nameData, (string));

// Check existence
bool exists = identityRegistry.agentExists(agentId);
uint256 total = identityRegistry.totalAgents();

// Transfer ownership (it's an NFT!)
identityRegistry.transferFrom(currentOwner, newOwner, agentId);
```

### ReputationRegistry.sol

**Purpose**: Store and aggregate feedback for agents

**Key Features**:
- Cryptographic authorization (EIP-191/ERC-1271 signatures)
- Score-based feedback (0-100 scale)
- Tag-based categorization
- Feedback revocation
- Response threading
- On-chain aggregation

**Example Usage**:
```solidity
// Give feedback (requires signature from agent)
reputationRegistry.giveFeedback(
    agentId,
    95, // score 0-100
    bytes32("quality"),
    bytes32("fast"),
    "ipfs://feedback-details",
    keccak256("feedback-data"),
    signedAuthorization
);

// Get summary
(uint64 count, uint8 avgScore) = reputationRegistry.getSummary(
    agentId,
    new address[](0), // all clients
    bytes32(0),       // all tags
    bytes32(0)
);

// Revoke feedback
reputationRegistry.revokeFeedback(agentId, feedbackIndex);

// Append response
reputationRegistry.appendResponse(
    agentId,
    clientAddress,
    feedbackIndex,
    "ipfs://our-response",
    keccak256("response-data")
);
```

### ValidationRegistry.sol

**Purpose**: Request and record independent validations

**Key Features**:
- Validation request/response system
- Multiple responses per request (progressive validation)
- Tag-based categorization
- On-chain aggregation
- Supports various validation methods (stake, zkML, TEE)

**Example Usage**:
```solidity
// Request validation
validationRegistry.validationRequest(
    validatorAddress,
    agentId,
    "ipfs://validation-request",
    keccak256("request-data")
);

// Validator responds
validationRegistry.validationResponse(
    requestHash,
    90, // validation score 0-100
    "ipfs://validation-result",
    keccak256("result-data"),
    bytes32("approved")
);

// Get validation status
(
    address validator,
    uint256 agentId,
    uint8 response,
    bytes32 tag,
    uint256 lastUpdate
) = validationRegistry.getValidationStatus(requestHash);

// Get summary
(uint64 count, uint8 avgResponse) = validationRegistry.getSummary(
    agentId,
    new address[](0), // all validators
    bytes32(0)        // all tags
);
```

## Integration with Jeju Paymaster

Agents can earn revenue by integrating with the Jeju paymaster system:

```solidity
// 1. Register your agent
uint256 agentId = identityRegistry.register("ipfs://my-agent");

// 2. Set your revenue wallet in metadata
identityRegistry.setMetadata(agentId, "revenueWallet", abi.encode(myWallet));

// 3. Users include your revenue wallet in paymasterAndData
// 4. You earn 50% of transaction fees automatically!
```

## Deployment

### Deployed Addresses

The registry is deployed as part of the liquidity system:

```bash
# Deploy everything
forge script script/DeployLiquiditySystem.s.sol:DeployLiquiditySystem \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify

# Deployment includes:
# - IdentityRegistry
# - ReputationRegistry  
# - ValidationRegistry
# (plus all paymaster contracts)
```

### Standalone Deployment

Deploy only the registry system:

```solidity
// Deploy in order:
IdentityRegistry identityRegistry = new IdentityRegistry();
ReputationRegistry reputationRegistry = new ReputationRegistry(address(identityRegistry));
ValidationRegistry validationRegistry = new ValidationRegistry(address(identityRegistry));
```

## Testing

```bash
# Run all registry tests
forge test --match-path "test/*Registry*.t.sol" -vv

# Test identity registry only
forge test --match-contract IdentityRegistryTest -vv

# Test integration
forge test --match-contract RegistryIntegrationTest -vv
```

## Viewing Registered Agents

### Web Viewer

1. Start local server:
   ```bash
   cd contracts/web
   python3 -m http.server 3000
   ```

2. Open browser:
   ```
   http://localhost:3000/registry-viewer.html
   ```

3. Connect wallet and view all registered agents with their metadata

### Contract Queries

```bash
# Get total agents
cast call $IDENTITY_REGISTRY "totalAgents()"

# Get agent owner
cast call $IDENTITY_REGISTRY "ownerOf(uint256)" 1

# Get agent metadata
cast call $IDENTITY_REGISTRY "getMetadata(uint256,string)" 1 "name"
```

## Standard Compliance

Implements [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) v1.0 specification:

- ✅ Identity Registry (ERC-721 based)
- ✅ Reputation Registry (feedback system)
- ✅ Validation Registry (verification system)
- ✅ Metadata storage and retrieval
- ✅ Event emissions
- ✅ On-chain aggregation

## Security Considerations

### IdentityRegistry
- Agent NFTs are transferable (consider implications)
- Only owner/approved can set metadata
- Metadata is public and immutable once set

### ReputationRegistry  
- Requires cryptographic signatures for feedback
- Supports both EOA (EIP-191) and smart contracts (ERC-1271)
- Feedback can be revoked by client
- Anyone can append responses

### ValidationRegistry
- Only agent owner can request validation
- Only designated validator can respond
- Progressive validation supported (multiple responses)
- All data is public

## Gas Costs

Approximate gas costs on Jeju (subject to change):

| Operation | Gas | Cost @ 1 gwei |
|-----------|-----|---------------|
| Register agent (no metadata) | ~75,000 | ~$0.00008 |
| Register with metadata | ~300,000 | ~$0.0003 |
| Set metadata | ~50,000 | ~$0.00005 |
| Give feedback | ~150,000 | ~$0.00015 |
| Request validation | ~120,000 | ~$0.00012 |
| Validation response | ~80,000 | ~$0.00008 |

## Examples

### Register AI Chat Agent

```solidity
// Create agent card
string memory agentCard = uploadToIPFS({
    "name": "AI Assistant",
    "description": "Helpful AI chatbot",
    "model": "GPT-4-Turbo",
    "capabilities": ["chat", "code", "analysis"]
});

// Register
uint256 agentId = identityRegistry.register(agentCard);

// Set metadata
identityRegistry.setMetadata(agentId, "name", abi.encode("AI Assistant"));
identityRegistry.setMetadata(agentId, "model", abi.encode("GPT-4-Turbo"));
identityRegistry.setMetadata(agentId, "status", abi.encode("active"));
```

### Build Reputation

```solidity
// Client gives feedback (needs agent's signature)
reputationRegistry.giveFeedback(
    agentId,
    100, // Perfect score!
    bytes32("quality"),
    bytes32("helpful"),
    "ipfs://detailed-feedback",
    keccak256("feedback-content"),
    signature
);

// Check average score
(uint64 count, uint8 avgScore) = reputationRegistry.getSummary(
    agentId,
    new address[](0),
    bytes32(0),
    bytes32(0)
);
```

### Get Validated

```solidity
// Request validation from TEE provider
validationRegistry.validationRequest(
    teeValidatorAddress,
    agentId,
    "ipfs://code-and-config",
    keccak256("validation-request")
);

// TEE validator responds
validationRegistry.validationResponse(
    requestHash,
    95, // Validation score
    "ipfs://tee-attestation",
    keccak256("attestation-data"),
    bytes32("tee-verified")
);
```

## Future Enhancements

- [ ] Agent search and filtering
- [ ] Reputation dashboard
- [ ] Validation marketplace
- [ ] Cross-chain agent identity
- [ ] Agent analytics and insights
- [ ] Automated reputation aggregation
- [ ] Integration with AI agent frameworks

## Resources

- ERC-8004 Specification: https://eips.ethereum.org/EIPS/eip-8004
- Jeju Documentation: https://docs.jeju.network/registry
- Web Viewer: `contracts/web/registry-viewer.html`
- Tests: `contracts/test/*Registry*.t.sol`

## Support & Contact

- Discord: https://discord.gg/jeju
- Security: security@jeju.network
- Docs: https://docs.jeju.network


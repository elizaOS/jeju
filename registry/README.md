# ERC-8004 Trustless Agents Reference Implementation

[![License: CC0-1.0](https://img.shields.io/badge/License-CC0_1.0-lightgrey.svg)](http://creativecommons.org/publicdomain/zero/1.0/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.19-blue)](https://soliditylang.org)
[![Tests](https://img.shields.io/badge/Tests-79%2F79%20Passing-brightgreen)](https://github.com/ChaosChain/trustless-agents-erc-ri)
[![Deployed](https://img.shields.io/badge/Deployed-5%20Testnets-success)](https://github.com/ChaosChain/trustless-agents-erc-ri#deployed-contracts)
[![Networks](https://img.shields.io/badge/Networks-Sepolia%20|%20Base%20|%20Optimism%20|%20Mode%20|%200G-blue)](https://github.com/ChaosChain/trustless-agents-erc-ri#deployed-contracts)

Reference implementation for **[ERC-8004: Trustless Agents](https://eips.ethereum.org/EIPS/eip-8004)** - a protocol enabling participants to discover, choose, and interact with AI agents across organizational boundaries without pre-existing trust.

>  **Ready to Use!** Contracts are live on **5 testnets**. Start building immediately - no deployment needed!  
> **Same addresses everywhere**: `0x7177...Dd09A` (Identity) | [View All Networks](#deployed-contracts)

## Table of Contents

- [Overview](#overview)
- [Version 1.0 (Current)](#version-10-current)
- [Gas Optimization](#gas-optimization)
- [Legacy Deployments](#legacy-deployments-v04)
- [Quick Start](#quick-start)
- [Contract Specifications](#contract-specifications)
- [Integration Examples](#integration-examples)
- [Testing](#testing)
- [Security](#security)
- [Migration Guide](#migration-guide)
- [Contributing](#contributing)

---

## Overview

ERC-8004 provides three core on-chain registries that enable trustless agent interactions:

| Registry | Purpose | v1.0 Implementation |
|----------|---------|-------------------|
| **Identity Registry** | Agent identity management | ERC-721 with URIStorage |
| **Reputation Registry** | Feedback and scoring system | Cryptographic signatures (EIP-191/ERC-1271) |
| **Validation Registry** | Independent work verification | URI-based evidence with tags |

### Key Features

- **ERC-721 Native** - Agents are NFTs, compatible with existing NFT infrastructure
- **Cryptographic Authorization** - Signature-based feedback authentication
- **On-Chain Composability** - Scores and tags accessible to smart contracts
- **Off-Chain Scalability** - Detailed data stored via URIs (IPFS recommended)
- **Event-Driven** - Comprehensive events for indexing and aggregation
- **Production Ready** - 79/79 tests passing, 100% spec compliant
- **Gas Optimized** - IR compiler enabled, efficient storage patterns

---

## Version 1.0 (Current)

### Status

- **Specification**: ERC-8004 v1.0
- **Implementation**: [`src/`](./src/)
- **Tests**: 79/79 passing (100% coverage)
- **Compliance**: 100% spec compliant
- **Deployment**: ✅ Live on 5 testnets

### Deployed Contracts

**Contract Addresses** (deterministic - same on all networks):

```
IdentityRegistry:    0x7177a6867296406881E20d6647232314736Dd09A
ReputationRegistry:  0xB5048e3ef1DA4E04deB6f7d0423D06F63869e322
ValidationRegistry:  0x662b40A526cb4017d947e71eAF6753BF3eeE66d8
```

**Live Networks**:

| Network | Chain ID | Identity | Reputation | Validation |
|---------|----------|----------|------------|------------|
| **Ethereum Sepolia** | 11155111 | [View](https://sepolia.etherscan.io/address/0x7177a6867296406881E20d6647232314736Dd09A) | [View](https://sepolia.etherscan.io/address/0xB5048e3ef1DA4E04deB6f7d0423D06F63869e322) | [View](https://sepolia.etherscan.io/address/0x662b40A526cb4017d947e71eAF6753BF3eeE66d8) |
| **Base Sepolia** | 84532 | [View](https://sepolia.basescan.org/address/0x7177a6867296406881E20d6647232314736Dd09A) | [View](https://sepolia.basescan.org/address/0xB5048e3ef1DA4E04deB6f7d0423D06F63869e322) | [View](https://sepolia.basescan.org/address/0x662b40A526cb4017d947e71eAF6753BF3eeE66d8) |
| **Optimism Sepolia** | 11155420 | [View](https://sepolia-optimistic.etherscan.io/address/0x7177a6867296406881E20d6647232314736Dd09A) | [View](https://sepolia-optimistic.etherscan.io/address/0xB5048e3ef1DA4E04deB6f7d0423D06F63869e322) | [View](https://sepolia-optimistic.etherscan.io/address/0x662b40A526cb4017d947e71eAF6753BF3eeE66d8) |
| **Mode Testnet** | 919 | [View](https://sepolia.explorer.mode.network/address/0x7177a6867296406881E20d6647232314736Dd09A) | [View](https://sepolia.explorer.mode.network/address/0xB5048e3ef1DA4E04deB6f7d0423D06F63869e322) | [View](https://sepolia.explorer.mode.network/address/0x662b40A526cb4017d947e71eAF6753BF3eeE66d8) |
| **0G Testnet** | 16602 | [View](https://chainscan-galileo.0g.ai/address/0x7177a6867296406881E20d6647232314736Dd09A) | [View](https://chainscan-galileo.0g.ai/address/0xB5048e3ef1DA4E04deB6f7d0423D06F63869e322) | [View](https://chainscan-galileo.0g.ai/address/0x662b40A526cb4017d947e71eAF6753BF3eeE66d8) |

>  **Why These Networks?**
> - **Ethereum Sepolia**: Industry standard testnet
> - **Base**: Coinbase's L2, ideal for consumer apps
> - **Optimism**: Leading OP Stack L2
> - **Mode**: AI-focused L2 with ultra-low gas (5,000x cheaper!)
> - **0G**: High-performance chain with 2,500 TPS


### Architecture

#### 1. Identity Registry

**ERC-721 based agent registry with URIStorage**

```solidity
contract IdentityRegistry is ERC721URIStorage {
    // Registration (3 variants)
    function register(string tokenURI, MetadataEntry[] metadata) returns (uint256 agentId);
    function register(string tokenURI) returns (uint256 agentId);
    function register() returns (uint256 agentId);
    
    // Metadata management
    function setMetadata(uint256 agentId, string key, bytes value) external;
    function getMetadata(uint256 agentId, string key) returns (bytes value);
    
    // ERC-721 standard functions
    function ownerOf(uint256 agentId) returns (address);
    function tokenURI(uint256 agentId) returns (string);
    function transferFrom(address from, address to, uint256 agentId) external;
    function approve(address to, uint256 agentId) external;
    // ... all ERC-721 functions
}
```

**Key Capabilities**:
- Agents represented as ERC-721 NFTs (transferable, tradeable)
- `tokenURI` points to registration JSON file (IPFS/HTTPS)
- On-chain key-value metadata storage
- Operator delegation via ERC-721 approvals
- Compatible with OpenSea, Rarible, and all NFT platforms

**Registration File Format**:
```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "myAgentName",
  "description": "Agent description and capabilities",
  "image": "https://example.com/agent.png",
  "endpoints": [
    {"name": "A2A", "endpoint": "https://agent.example/.well-known/agent-card.json"},
    {"name": "MCP", "endpoint": "https://mcp.agent.eth/"},
    {"name": "agentWallet", "endpoint": "eip155:1:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7"}
  ],
  "registrations": [
    {"agentId": 22, "agentRegistry": "eip155:1:{identityRegistry}"}
  ],
  "supportedTrust": ["reputation", "crypto-economic", "tee-attestation"]
}
```

**Events**:
```solidity
event Registered(uint256 indexed agentId, string tokenURI, address indexed owner);
event MetadataSet(uint256 indexed agentId, string indexed indexedKey, string key, bytes value);
event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
```

#### 2. Reputation Registry

**On-chain feedback system with cryptographic authorization**

```solidity
contract ReputationRegistry {
    // Give feedback (requires signature)
    function giveFeedback(
        uint256 agentId,
        uint8 score,              // 0-100
        bytes32 tag1,             // optional
        bytes32 tag2,             // optional
        string fileuri,           // optional IPFS/HTTPS
        bytes32 filehash,         // optional (not needed for IPFS)
        bytes feedbackAuth        // EIP-191/ERC-1271 signature
    ) external;
    
    // Revoke feedback
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;
    
    // Append response (anyone can respond)
    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string responseUri,
        bytes32 responseHash
    ) external;
    
    // Read functions with filtering
    function getSummary(
        uint256 agentId,
        address[] clientAddresses,
        bytes32 tag1,
        bytes32 tag2
    ) returns (uint64 count, uint8 averageScore);
    
    function readFeedback(uint256 agentId, address clientAddress, uint64 index) 
        returns (uint8 score, bytes32 tag1, bytes32 tag2, bool isRevoked);
    
    function readAllFeedback(
        uint256 agentId,
        address[] clientAddresses,
        bytes32 tag1,
        bytes32 tag2,
        bool includeRevoked
    ) returns (address[], uint8[], bytes32[], bytes32[], bool[]);
    
    function getClients(uint256 agentId) returns (address[]);
    function getLastIndex(uint256 agentId, address clientAddress) returns (uint64);
}
```

**Key Capabilities**:
- Signature-based authorization (EIP-191 for EOAs, ERC-1271 for smart contracts)
- On-chain scores (0-100) and tags for composability
- Off-chain detailed feedback via URIs
- Filtering by clients and tags
- Response system for disputes/clarifications
- Sybil attack mitigation through client filtering

**Authorization Flow**:
1. Agent accepts task
2. Agent signs `FeedbackAuth` struct
3. Client calls `giveFeedback()` with signed authorization
4. Contract verifies signature and stores feedback on-chain

**FeedbackAuth Structure**:
```solidity
struct FeedbackAuth {
    uint256 agentId;
    address clientAddress;
    uint64 indexLimit;        // Prevents replay
    uint256 expiry;           // Time-bound
    uint256 chainId;          // Chain-specific
    address identityRegistry; // Registry-specific
    address signerAddress;    // Signer identification
}
```

**Events**:
```solidity
event NewFeedback(uint256 indexed agentId, address indexed clientAddress, uint8 score, bytes32 indexed tag1, bytes32 tag2, string fileuri, bytes32 filehash);
event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex);
event ResponseAppended(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, address indexed responder, string responseUri);
```

#### 3. Validation Registry

**Independent work validation with URI-based evidence**

```solidity
contract ValidationRegistry {
    // Request validation
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string requestUri,
        bytes32 requestHash        // optional for IPFS
    ) external;
    
    // Respond to validation
    function validationResponse(
        bytes32 requestHash,
        uint8 response,            // 0-100
        string responseUri,        // optional
        bytes32 responseHash,      // optional
        bytes32 tag                // optional
    ) external;
    
    // Read functions
    function getValidationStatus(bytes32 requestHash) 
        returns (address validatorAddress, uint256 agentId, uint8 response, bytes32 tag, uint256 lastUpdate);
    
    function getSummary(uint256 agentId, address[] validatorAddresses, bytes32 tag) 
        returns (uint64 count, uint8 avgResponse);
    
    function getAgentValidations(uint256 agentId) returns (bytes32[]);
    function getValidatorRequests(address validatorAddress) returns (bytes32[]);
}
```

**Key Capabilities**:
- URI-based evidence for transparency
- Multiple responses per request (progressive validation)
- Tags for categorization (e.g., "soft-finality", "hard-finality")
- Filtering by validators
- Composable validation scores
- Supports various validation methods (stake-secured, zkML, TEE)

**Events**:
```solidity
event ValidationRequest(address indexed validatorAddress, uint256 indexed agentId, string requestUri, bytes32 indexed requestHash);
event ValidationResponse(address indexed validatorAddress, uint256 indexed agentId, bytes32 indexed requestHash, uint8 response, string responseUri, bytes32 tag);
```

---

## Gas Optimization

v1.0 is highly optimized for gas efficiency:

### Gas Usage

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| **Agent Registration** | ~99k gas | With tokenURI |
| **Register with Metadata** | ~171k gas | With single metadata entry |
| **Give Feedback** | ~276k gas | Includes signature verification |
| **Revoke Feedback** | ~294k gas | Marks feedback as revoked |
| **Append Response** | ~300k gas | Add response to feedback |
| **Validation Request** | ~306k gas | Create validation request |
| **Validation Response** | ~418k gas | Submit validation response |

### Optimization Techniques

- **IR Optimizer Enabled** - `via_ir = true` in foundry.toml for advanced optimizations
- **Efficient Storage** - Packed structs, minimal on-chain storage
- **Assembly Usage** - Signature extraction uses assembly for gas savings
- **Event-Driven** - Detailed data in events rather than storage
- **Off-Chain Data** - URIs for large data (IPFS recommended)

### Comparison with v0.4

| Operation | v0.4 | v1.0 | Improvement |
|-----------|------|------|-------------|
| Agent Registration | ~142k | ~99k | **30% reduction** |
| Feedback | ~76k | ~276k | More features* |
| Validation Request | ~115k | ~306k | More features* |

*v1.0 includes signature verification, on-chain storage, and enhanced features

---

## Legacy Deployments (v0.4)

The previous v0.4 implementation remains deployed on testnets for backward compatibility. These contracts are **deprecated** for new deployments.

### Deployed Contracts (Testnet Only)

#### Ethereum Sepolia

| Contract | Address | Explorer |
|----------|---------|----------|
| Identity Registry | `0x127C86a24F46033E77C347258354ee4C739b139C` | [View](https://sepolia.etherscan.io/address/0x127C86a24F46033E77C347258354ee4C739b139C) |
| Reputation Registry | `0x57396214E6E65E9B3788DE7705D5ABf3647764e0` | [View](https://sepolia.etherscan.io/address/0x57396214E6E65E9B3788DE7705D5ABf3647764e0) |
| Validation Registry | `0x5d332cE798e491feF2de260bddC7f24978eefD85` | [View](https://sepolia.etherscan.io/address/0x5d332cE798e491feF2de260bddC7f24978eefD85) |

#### Base Sepolia

| Contract | Address | Explorer |
|----------|---------|----------|
| Identity Registry | `0x19fad4adD9f8C4A129A078464B22E1506275FbDd` | [View](https://sepolia.basescan.org/address/0x19fad4adD9f8C4A129A078464B22E1506275FbDd) |
| Reputation Registry | `0xA13497975fd3f6cA74081B074471C753b622C903` | [View](https://sepolia.basescan.org/address/0xA13497975fd3f6cA74081B074471C753b622C903) |
| Validation Registry | `0x6e24aA15e134AF710C330B767018d739CAeCE293` | [View](https://sepolia.basescan.org/address/0x6e24aA15e134AF710C330B767018d739CAeCE293) |

#### Optimism Sepolia

| Contract | Address | Explorer |
|----------|---------|----------|
| Identity Registry | `0x19fad4adD9f8C4A129A078464B22E1506275FbDd` | [View](https://sepolia-optimistic.etherscan.io/address/0x19fad4adD9f8C4A129A078464B22E1506275FbDd) |
| Reputation Registry | `0xA13497975fd3f6cA74081B074471C753b622C903` | [View](https://sepolia-optimistic.etherscan.io/address/0xA13497975fd3f6cA74081B074471C753b622C903) |
| Validation Registry | `0x6e24aA15e134AF710C330B767018d739CAeCE293` | [View](https://sepolia-optimistic.etherscan.io/address/0x6e24aA15e134AF710C330B767018d739CAeCE293) |

### Web Interface (Legacy)

A web interface for the legacy v0.4 contracts is available:

- **Live Demo**: [https://chaoschain.github.io/trustless-agents-erc-ri/](https://chaoschain.github.io/trustless-agents-erc-ri/)
- **Local**: `cd web && python3 -m http.server 8000`

**Features**:
- Agent registration with domain/address
- Quick search by domain
- Browse all registered agents
- Multi-network support (Ethereum, Base, Optimism Sepolia)
- MetaMask integration

> **Note**: This web interface connects to v0.4 contracts. A v1.0 interface is planned.

### Key Differences: v0.4 vs v1.0

| Feature | v0.4 | v1.0 |
|---------|------|------|
| **Identity** | Custom system with domain/address | ERC-721 NFTs with URIStorage |
| **Reputation** | Pre-authorization pattern | Cryptographic signatures |
| **Validation** | Hash-based, time-bounded | URI-based, tag system |
| **Transferability** | No | Yes (via ERC-721) |
| **NFT Compatible** | No | Yes |
| **On-chain Data** | Minimal | Scores, tags, composable |
| **Signature Scheme** | N/A | EIP-191/ERC-1271 |

---

## Quick Start

### Start Building Now (No Setup Required!)

**Contracts are already deployed and ready to use!** Just connect to any testnet:

```javascript
// ethers.js example - works on all 5 testnets
const identityRegistry = '0x7177a6867296406881E20d6647232314736Dd09A';
const reputationRegistry = '0xB5048e3ef1DA4E04deB6f7d0423D06F63869e322';
const validationRegistry = '0x662b40A526cb4017d947e71eAF6753BF3eeE66d8';

// Pick your network:
// - Sepolia: https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
// - Base: https://sepolia.base.org
// - Optimism: https://sepolia.optimism.io
// - Mode: https://sepolia.mode.network (cheapest gas!)
// - 0G: https://evmrpc-testnet.0g.ai (highest TPS!)
```

See [Integration Examples](#integration-examples) for complete code samples →

---

### 🛠️ Local Development Setup

For contributing or deploying your own instance:

#### Prerequisites

- [Foundry](https://book.getfoundry.sh/) (for contract development)
- [Node.js](https://nodejs.org/) 16+ (optional, for web interface)
- [Git](https://git-scm.com/)

#### Installation

```bash
# Clone repository
git clone https://github.com/ChaosChain/trustless-agents-erc-ri.git
cd trustless-agents-erc-ri

# Install dependencies
forge install
```

#### Build

```bash
# Compile contracts
forge build

# Compile with gas reporting
forge build --sizes
```

#### Test

```bash
# Run all tests
forge test

# Run with verbose output
forge test -vv

# Run specific test file
forge test --match-path test/IdentityRegistry.t.sol
forge test --match-path test/ReputationRegistry.t.sol
forge test --match-path test/ValidationRegistry.t.sol

# Run with gas reporting
forge test --gas-report

# Generate gas snapshots
forge snapshot
```

### Deploy to Testnets

Deploy your own instance to any network:

```bash
# 1. Configure environment variables
cp .env.example .env
# Edit .env with your PRIVATE_KEY and RPC URLs

# 2. Deploy to a specific network
./deploy.sh sepolia          # Ethereum Sepolia
./deploy.sh base_sepolia     # Base Sepolia
./deploy.sh optimism_sepolia # Optimism Sepolia
./deploy.sh mode_testnet     # Mode Testnet (ultra-low gas!)
./deploy.sh zg_testnet       # 0G Testnet

# 3. Or deploy to all networks at once
./deploy.sh all

# Manual deployment (any network)
forge script script/Deploy.s.sol:Deploy \
    --rpc-url $RPC_URL \
    --broadcast \
    --verify
```

**Deployment Guides**:
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Complete multi-chain deployment guide
- [MODE_DEPLOYMENT.md](./MODE_DEPLOYMENT.md) - Mode Network specific guide
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Pre/post deployment checklist

---

## Contract Specifications

### Import Paths

```solidity
// Using in your contracts
import "trustless-agents-erc-ri/src/IdentityRegistry.sol";
import "trustless-agents-erc-ri/src/ReputationRegistry.sol";
import "trustless-agents-erc-ri/src/ValidationRegistry.sol";

// Interfaces
import "trustless-agents-erc-ri/src/interfaces/IIdentityRegistry.sol";
import "trustless-agents-erc-ri/src/interfaces/IReputationRegistry.sol";
import "trustless-agents-erc-ri/src/interfaces/IValidationRegistry.sol";
```

---

## Integration Examples

### Quick Start: Using Live Contracts

Try these examples on any of the deployed testnets:

```javascript
// Using ethers.js v6 with live contracts on Sepolia
import { ethers } from 'ethers';

// Connect to Sepolia
const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY');
const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);

// Live IdentityRegistry on Sepolia
const identityRegistry = new ethers.Contract(
    '0x7177a6867296406881E20d6647232314736Dd09A',
    ['function register(string) returns (uint256)',
     'function tokenURI(uint256) view returns (string)',
     'function ownerOf(uint256) view returns (address)'],
    wallet
);

// Register your first agent!
const tx = await identityRegistry.register('ipfs://QmYourAgentData...');
await tx.wait();
console.log('Agent registered! 🎉');
```

**Try it on other networks too:**
- Base Sepolia: `https://sepolia.base.org`
- Optimism Sepolia: `https://sepolia.optimism.io`
- Mode Testnet: `https://sepolia.mode.network` (ultra-low gas!)
- 0G Testnet: `https://evmrpc-testnet.0g.ai`

### Registering an Agent (Solidity)

```solidity
// Prepare metadata
IIdentityRegistry.MetadataEntry[] memory metadata = new IIdentityRegistry.MetadataEntry[](2);
metadata[0] = IIdentityRegistry.MetadataEntry({
    key: "agentName",
    value: abi.encodePacked("MyAgent")
});
metadata[1] = IIdentityRegistry.MetadataEntry({
    key: "agentWallet",
    value: abi.encode(agentWalletAddress)
});

// Register agent on any network at 0x7177a6867296406881E20d6647232314736Dd09A
uint256 agentId = identityRegistry.register(
    "ipfs://QmXYZ.../registration.json",
    metadata
);

// Agent is now an ERC-721 NFT owned by msg.sender
// Can be transferred: identityRegistry.transferFrom(from, to, agentId);
```

### Giving Feedback

```solidity
// 1. Agent signs authorization (off-chain or in contract)
IReputationRegistry.FeedbackAuth memory auth = IReputationRegistry.FeedbackAuth({
    agentId: 123,
    clientAddress: msg.sender,
    indexLimit: 1,
    expiry: block.timestamp + 1 days,
    chainId: block.chainid,
    identityRegistry: address(identityRegistry),
    signerAddress: agentOwner
});

// 2. Sign the auth struct (EIP-191 format)
bytes32 structHash = keccak256(abi.encode(
    auth.agentId,
    auth.clientAddress,
    auth.indexLimit,
    auth.expiry,
    auth.chainId,
    auth.identityRegistry,
    auth.signerAddress
));
bytes32 messageHash = keccak256(abi.encodePacked(
    "\x19Ethereum Signed Message:\n32",
    structHash
));
bytes memory signature = signMessage(messageHash, agentPrivateKey);

// 3. Pack auth + signature
bytes memory feedbackAuth = abi.encodePacked(
    abi.encode(auth),
    signature
);

// 4. Client gives feedback
reputationRegistry.giveFeedback(
    123,                    // agentId
    95,                     // score (0-100)
    "quality",              // tag1
    "speed",                // tag2
    "ipfs://QmABC...",      // fileuri (optional)
    bytes32(0),             // filehash (optional, not needed for IPFS)
    feedbackAuth            // packed auth + signature
);
```

### Reading Agent Reputation

```solidity
// Get summary for all feedback
(uint64 count, uint8 avgScore) = reputationRegistry.getSummary(
    agentId,
    new address[](0),  // empty = all clients
    bytes32(0),        // no tag filter
    bytes32(0)
);

// Get summary filtered by specific clients and tags
address[] memory trustedClients = new address[](2);
trustedClients[0] = client1;
trustedClients[1] = client2;

(count, avgScore) = reputationRegistry.getSummary(
    agentId,
    trustedClients,
    bytes32("quality"),
    bytes32(0)
);
```

### Requesting Validation

```solidity
// 1. Agent requests validation (must be agent owner/operator)
validationRegistry.validationRequest(
    validatorAddress,
    agentId,
    "ipfs://QmDEF.../validation-request.json",
    bytes32(0)  // hash optional for IPFS
);

// 2. Validator responds (only designated validator can respond)
validationRegistry.validationResponse(
    requestHash,
    100,                    // response (0-100)
    "ipfs://QmGHI.../validation-response.json",
    bytes32(0),             // hash optional for IPFS
    "hard-finality"         // tag
);

// 3. Can respond again with different tag (progressive validation)
validationRegistry.validationResponse(
    requestHash,
    100,
    "",
    bytes32(0),
    "soft-finality"
);
```

---

## Testing

### Test Coverage

All contracts are **100% tested and verified on live testnets**! 

**Unit Tests** (local):
```bash
$ forge test

╭────────────────────────┬────────┬────────┬─────────╮
│ Test Suite             │ Passed │ Failed │ Skipped │
├────────────────────────┼────────┼────────┼─────────┤
│ IdentityRegistry       │   22   │   0    │    0    │
│ ReputationRegistry     │   26   │   0    │    0    │
│ ValidationRegistry     │   31   │   0    │    0    │
╰────────────────────────┴────────┴────────┴─────────╯

Total: 79 tests passed, 0 failed, 0 skipped
```

**Live Network Tests** (verified):
- ✅ 5/5 networks tested with real transactions
- ✅ Agent registration confirmed on all chains
- ✅ TokenURI retrieval verified
- ✅ Event emission validated
- ✅ Gas efficiency confirmed (30% less on L2s)

See [TEST_RESULTS.md](./TEST_RESULTS.md) for complete live testing report.

### Test Categories

**IdentityRegistry (22 tests)**:
- Registration variants
- Metadata management
- ERC-721 compliance
- Authorization checks
- Edge cases

**ReputationRegistry (26 tests)**:
- Signature verification (EIP-191/ERC-1271)
- Feedback submission and self-feedback prevention
- Revocation
- Response appending
- Filtering and aggregation
- Authorization checks

**ValidationRegistry (31 tests)**:
- Request creation and self-validation prevention
- Response submission
- Multiple responses
- Authorization checks
- Filtering and aggregation

### Running Tests

```bash
# All tests
forge test

# Specific test suite
forge test --match-contract IdentityRegistryTest
forge test --match-contract ReputationRegistryTest
forge test --match-contract ValidationRegistryTest

# Specific test function
forge test --match-test test_Register_WithTokenURIOnly
forge test --match-test test_GiveFeedback_Success

# With detailed traces
forge test -vvvv

# With gas snapshots
forge snapshot
```

---

## Security

### Signature Verification

The Reputation Registry uses industry-standard signature schemes:

- **EIP-191** - Personal sign format for EOA wallets
- **ERC-1271** - Contract signature verification for smart contract wallets
- Both schemes prevent replay attacks via `chainId`, `expiry`, and `indexLimit`

### Authorization Mechanisms

| Registry | Authorization Method |
|----------|---------------------|
| Identity Registry | ERC-721 ownership and operator approvals |
| Reputation Registry | Cryptographic signatures (EIP-191/ERC-1271) |
| Validation Registry | ERC-721 ownership for requests, designated validator for responses |

### Replay Protection

All signed messages include:
- `chainId` - Prevents cross-chain replay
- `identityRegistry` - Prevents cross-registry replay
- `expiry` - Time-bound validity
- `indexLimit` - Prevents signature reuse

### Input Validation

- Score ranges enforced (0-100)
- Address zero checks
- URI length validation
- Agent existence verification
- Index bounds checking

### Security Enhancements

Beyond the base ERC-8004 v1.0 specification, this reference implementation includes additional security measures:

#### Self-Feedback Prevention
The Reputation Registry prevents agents from giving feedback to themselves, ensuring reputation integrity.

#### Self-Validation Prevention
The Validation Registry prevents agents from validating their own work, enforcing independent verification as intended by the spec.

#### Reentrancy Protection
The Identity Registry uses OpenZeppelin's `ReentrancyGuard` to prevent reentrancy attacks during agent registration via the `_safeMint` callback.

#### Integrity Hash Emission
Both Reputation and Validation registries emit `responseHash` in their events, enabling off-chain verification of data integrity for URIs not on content-addressable storage.

#### RequestHash Uniqueness
The Validation Registry enforces global uniqueness of request hashes to prevent hijacking attacks.

### Audit Status

- **Self-audited**: Comprehensive test coverage (79/79 tests)
- **Spec compliance**: 100% compliant with ERC-8004 v1.0
- **Security hardened**: 10+ additional protections beyond spec requirements
- **External audit**: Recommended before mainnet deployment

---

## Migration Guide

### Migrating from v0.4 to v1.0

**v1.0 is not backward compatible with v0.4.** A full migration is required.

#### Key Changes

1. **Identity Registry**
   - v0.4: Custom identity system → v1.0: ERC-721 NFTs
   - Agents are now transferable
   - Registration requires `tokenURI` instead of domain/address

2. **Reputation Registry**
   - v0.4: Pre-authorization → v1.0: Cryptographic signatures
   - Must sign feedback authorization with EIP-191/ERC-1271
   - Scores and tags now stored on-chain

3. **Validation Registry**
   - v0.4: Hash-based → v1.0: URI-based
   - Evidence stored off-chain via URIs
   - Support for multiple responses per request

#### Migration Steps

1. **Deploy v1.0 contracts** on your target network
2. **Register agents** using new `register()` function with `tokenURI`
3. **Update client code** to use new signature scheme for feedback
4. **Update validator code** to use URI-based validation
5. **Test thoroughly** before switching production traffic

For detailed migration instructions, see **[CHANGELOG_V1.md](./CHANGELOG_V1.md)**.

---

## Documentation

### Core Documentation

- **[README.md](./README.md)** - This file (comprehensive guide)
- **[CHANGELOG_V1.md](./CHANGELOG_V1.md)** - Migration guide from v0.4
- **[ERC-8004-v1.md](./ERC-8004-v1.md)** - Full ERC-8004 v1.0 specification

### Technical Documentation

- **[src/IMPLEMENTATION_STATUS.md](./src/IMPLEMENTATION_STATUS.md)** - Production readiness checklist
- **[src/SPEC_COMPLIANCE_CHECKLIST.md](./src/SPEC_COMPLIANCE_CHECKLIST.md)** - 80+ requirement verification

### Legacy Documentation

- **[legacy/README.md](./legacy/README.md)** - v0.4 documentation and deployment info

---

## Contributing

We welcome contributions from the community!

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes
4. **Add** comprehensive tests
5. **Ensure** all tests pass (`forge test`)
6. **Commit** your changes (`git commit -m 'Add amazing feature'`)
7. **Push** to the branch (`git push origin feature/amazing-feature`)
8. **Open** a Pull Request

### Code Standards

- **Solidity Style Guide**: Follow [official Solidity style guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- **NatSpec**: Include comprehensive NatSpec documentation
- **Testing**: Maintain 100% test coverage
- **Gas Efficiency**: Optimize for gas usage
- **Spec Compliance**: Ensure ERC-8004 v1.0 compliance

### Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include reproduction steps for bugs
- Provide clear use cases for feature requests

---

## Repository Structure

```
trustless-agents-erc-ri/
├── src/                      # v1.0 contracts (main)
├── test/                     # v1.0 tests
├── script/                   # v1.0 deployment
├── legacy/                   # v0.4 contracts (deprecated)
├── web/                      # Web interface (v0.4, v1.0 update planned)
├── lib/                      # Dependencies
├── ERC-8004-v1.md           # v1.0 specification
├── CHANGELOG_V1.md          # Migration guide
└── README.md                # This file
```

---

## License

This project is licensed under **CC0-1.0** - see the [LICENSE](LICENSE) file for details.

All code is released into the public domain with no restrictions.

---

## Acknowledgments

- **ERC-8004 Working Group** - Specification development
- **[A2A Protocol](https://a2a-protocol.org/)** - Foundational agent communication work
- **[OpenZeppelin](https://openzeppelin.com/)** - Security patterns and contracts
- **Ethereum Community** - Feedback and support

---

## Links

- **Repository**: [github.com/ChaosChain/trustless-agents-erc-ri](https://github.com/ChaosChain/trustless-agents-erc-ri)
- **Specification**: [ERC-8004 Trustless Agents](https://eips.ethereum.org/EIPS/eip-8004)
- **A2A Protocol**: [a2a-protocol.org](https://a2a-protocol.org/)
- **Web Interface (Legacy)**: [chaoschain.github.io/trustless-agents-erc-ri](https://chaoschain.github.io/trustless-agents-erc-ri/)

---

## Contact

- **Issues**: [GitHub Issues](https://github.com/ChaosChain/trustless-agents-erc-ri/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ChaosChain/trustless-agents-erc-ri/discussions)

---

<div align="center">

**Built with ❤️ by ChaosChain for the open AI agentic economy**

[Report Bug](https://github.com/ChaosChain/trustless-agents-erc-ri/issues) · [Request Feature](https://github.com/ChaosChain/trustless-agents-erc-ri/issues) · [Documentation](https://eips.ethereum.org/EIPS/eip-8004)

</div>
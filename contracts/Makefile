.PHONY: install build test clean deploy-testnet deploy-mainnet

# Install dependencies
install:
	forge install foundry-rs/forge-std --no-commit
	forge install OpenZeppelin/openzeppelin-contracts --no-commit
	forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-commit
	forge install ethereum-optimism/optimism --no-commit
	@echo "✅ Dependencies installed"
	@echo ""
	@echo "📝 Next steps:"
	@echo "   1. cp .env.example .env"
	@echo "   2. Edit .env with your configuration"
	@echo "   3. make deploy-testnet"

# Build contracts
build:
	forge build

# Run tests
test:
	forge test -vvv

# Clean build artifacts
clean:
	forge clean
	rm -rf deployments/*/

# Deploy to testnet (Base Sepolia)
deploy-testnet:
	@echo "🚀 Deploying to Base Sepolia..."
	@forge script script/Deploy.s.sol:DeployL1 \
		--rpc-url $(BASE_SEPOLIA_RPC_URL) \
		--broadcast \
		--verify \
		--slow
	@echo "✅ L1 contracts deployed"
	@echo "📝 Next: Generate genesis with 'make genesis-testnet'"

# Deploy to mainnet (Base)
deploy-mainnet:
	@echo "🚀 Deploying to Base Mainnet..."
	@echo "⚠️  PRODUCTION DEPLOYMENT - Are you sure? (Ctrl+C to cancel)"
	@sleep 5
	@forge script script/Deploy.s.sol:DeployL1 \
		--rpc-url $(BASE_RPC_URL) \
		--broadcast \
		--verify \
		--slow
	@echo "✅ L1 contracts deployed"

# Generate genesis for testnet
genesis-testnet:
	@echo "📦 Generating L2 genesis..."
	@forge script script/Genesis.s.sol:GenerateGenesis \
		--sig "run(string)" testnet
	@echo "✅ Genesis files generated"
	@echo "📁 Check: deployments/testnet/genesis.json"
	@echo "📁 Check: deployments/testnet/rollup.json"

# Generate genesis for mainnet
genesis-mainnet:
	@forge script script/Genesis.s.sol:GenerateGenesis \
		--sig "run(string)" mainnet

# Deploy ERC-4337 to L2
deploy-aa:
	@echo "🚀 Deploying ERC-4337..."
	@forge script script/DeployAA.s.sol:DeployAA \
		--rpc-url $(JEJU_TESTNET_RPC_URL) \
		--broadcast
	@echo "✅ Account Abstraction deployed"

# Deploy Governance to L2
deploy-governance:
	@echo "🚀 Deploying Governance..."
	@forge script script/DeployGovernance.s.sol:DeployGovernance \
		--rpc-url $(JEJU_TESTNET_RPC_URL) \
		--broadcast
	@echo "✅ Governance deployed"

# Full deployment workflow for testnet
deploy-full-testnet: deploy-testnet genesis-testnet
	@echo "✅ Full testnet deployment complete!"
	@echo ""
	@echo "📝 Next steps:"
	@echo "   1. Update config/chain/testnet.json with contract addresses"
	@echo "   2. Copy genesis.json and rollup.json to Kubernetes"
	@echo "   3. Deploy infrastructure: bun run start"

# Verify contract on BaseScan
verify:
	@forge verify-contract \
		--chain-id 84532 \
		--watch \
		$(CONTRACT_ADDRESS) \
		$(CONTRACT_PATH)

# Help
help:
	@echo "Jeju L3 Contract Deployment"
	@echo ""
	@echo "Commands:"
	@echo "  make install          - Install Foundry dependencies"
	@echo "  make build            - Compile contracts"
	@echo "  make test             - Run tests"
	@echo "  make deploy-testnet   - Deploy L1 to Base Sepolia"
	@echo "  make genesis-testnet  - Generate L2 genesis"
	@echo "  make deploy-aa        - Deploy ERC-4337 to L2"
	@echo "  make deploy-governance - Deploy governance to L2"
	@echo "  make deploy-full-testnet - Full testnet deployment"
	@echo ""
	@echo "Environment Variables:"
	@echo "  Set in .env file (copy from .env.example)"



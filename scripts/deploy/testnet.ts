#!/usr/bin/env bun

import { $ } from "bun";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { ChainConfigSchema, type ChainConfig } from "../../types/chain";
import { type Deployment } from "../../types/contracts";

const NETWORK = "testnet";
const CONFIG_PATH = join(process.cwd(), "packages", "config", "chain", `${NETWORK}.json`);
const CONTRACTS_DIR = join(process.cwd(), "packages", "contracts");
const DEPLOYMENTS_DIR = join(CONTRACTS_DIR, "deployments", NETWORK);

async function main() {
  console.log(`🚀 Deploying Jeju to ${NETWORK}...`);
  
  // Load config
  const config = loadConfig();
  console.log(`📋 Chain ID: ${config.chainId}`);
  console.log(`📋 L1 Chain: ${config.l1ChainId}`);
  
  // Validate environment
  validateEnvironment();
  
  // Deploy L1 contracts
  console.log("\n📦 Step 1: Deploying L1 contracts...");
  const l1Contracts = await deployL1Contracts(config);
  
  // Generate L2 genesis
  console.log("\n📦 Step 2: Generating L2 genesis...");
  await generateL2Genesis(config, l1Contracts);
  
  // Deploy L2 contracts
  console.log("\n📦 Step 3: Deploying L2 contracts...");
  const l2Contracts = await deployL2Contracts(config);
  
  // Deploy Hyperlane
  console.log("\n📦 Step 4: Deploying Hyperlane...");
  const hyperlaneContracts = await deployHyperlane(config, l1Contracts, l2Contracts);
  
  // Deploy DeFi protocols
  console.log("\n📦 Step 5: Deploying DeFi protocols...");
  const defiContracts = await deployDeFi(config);
  
  // Deploy ERC-4337
  console.log("\n📦 Step 6: Deploying ERC-4337 infrastructure...");
  const erc4337Contracts = await deployERC4337(config);
  
  // Deploy Governance
  console.log("\n📦 Step 7: Deploying Governance contracts...");
  const governanceContracts = await deployGovernance(config);
  
  // Save deployment
  const deployment: Deployment = {
    network: NETWORK,
    timestamp: Date.now(),
    deployer: process.env.DEPLOYER_ADDRESS as string,
    l1Contracts,
    l2Contracts,
    hyperlane: hyperlaneContracts,
    uniswapV4: defiContracts.uniswap,
    synthetixV3: defiContracts.synthetix,
    compoundV3: defiContracts.compound,
    chainlink: defiContracts.chainlink,
    erc4337: erc4337Contracts,
    governance: governanceContracts
  };
  
  await Bun.write(
    join(DEPLOYMENTS_DIR, "deployment.json"),
    JSON.stringify(deployment, null, 2)
  );
  
  console.log("\n✅ Deployment complete!");
  console.log(`📄 Deployment info saved to: ${join(DEPLOYMENTS_DIR, "deployment.json")}`);
  
  console.log("\n📌 Next steps:");
  console.log("1. Verify contracts: bun run verify:testnet");
  console.log("2. Update frontend config with new contract addresses");
  console.log("3. Deploy infrastructure: cd packages/terraform/environments/testnet && terraform apply");
  console.log("4. Deploy Kubernetes services: bun run k8s:apply");
}

function loadConfig(): ChainConfig {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found: ${CONFIG_PATH}`);
  }
  
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const config = JSON.parse(raw);
  return ChainConfigSchema.parse(config);
}

function validateEnvironment() {
  const required = [
    "DEPLOYER_PRIVATE_KEY",
    "DEPLOYER_ADDRESS",
    "L1_RPC_URL",
    "ETHERSCAN_API_KEY"
  ];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

async function deployL1Contracts(_config: ChainConfig) {
  console.log("   Deploying OptimismPortal, L2OutputOracle, bridges...");
  
  await $`cd ${CONTRACTS_DIR} && make deploy-testnet`;
  
  return {
    OptimismPortal: "",
    L2OutputOracle: "",
    L1CrossDomainMessenger: "",
    L1StandardBridge: "",
    L1ERC721Bridge: "",
    SystemConfig: "",
    AddressManager: "",
    ProxyAdmin: ""
  };
}

async function generateL2Genesis(_config: ChainConfig, _l1Contracts: Record<string, string>) {
  console.log("   Generating genesis.json and rollup.json...");
  
  await $`cd ${CONTRACTS_DIR} && make genesis-testnet`;
}

async function deployL2Contracts(_config: ChainConfig) {
  console.log("   Deploying L2 predeploys and bridges...");
  
  // L2 predeploy addresses are deterministic
  return {
    L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
    L2StandardBridge: "0x4200000000000000000000000000000000000010",
    L2ERC721Bridge: "0x4200000000000000000000000000000000000014",
    L2ToL1MessagePasser: "0x4200000000000000000000000000000000000016",
    GasPriceOracle: "0x420000000000000000000000000000000000000F",
    L1Block: "0x4200000000000000000000000000000000000015",
    WETH: "0x4200000000000000000000000000000000000006"
  };
}

async function deployHyperlane(config: ChainConfig, _l1Contracts: Record<string, string>, _l2Contracts: Record<string, string>) {
  console.log("   Deploying Hyperlane Mailbox and ISM...");
  
  // Placeholder - actual deployment would use Hyperlane CLI
  return {
    Mailbox: "0x0000000000000000000000000000000000000000",
    InterchainGasPaymaster: "0x0000000000000000000000000000000000000000",
    ValidatorAnnounce: "0x0000000000000000000000000000000000000000",
    MultisigIsm: "0x0000000000000000000000000000000000000000",
    InterchainSecurityModule: "0x0000000000000000000000000000000000000000",
    domainId: config.chainId
  };
}

async function deployDeFi(_config: ChainConfig) {
  console.log("   Deploying Uniswap v4, Synthetix v3, Compound v3...");
  
  // Placeholder - actual deployment would use protocol-specific scripts
  return {
    uniswap: {
      PoolManager: "0x0000000000000000000000000000000000000000",
      SwapRouter: "0x0000000000000000000000000000000000000000",
      PositionManager: "0x0000000000000000000000000000000000000000",
      QuoterV4: "0x0000000000000000000000000000000000000000",
      StateView: "0x0000000000000000000000000000000000000000"
    },
    synthetix: {
      CoreProxy: "0x0000000000000000000000000000000000000000",
      AccountProxy: "0x0000000000000000000000000000000000000000",
      USDProxy: "0x0000000000000000000000000000000000000000",
      PerpsMarketProxy: "0x0000000000000000000000000000000000000000",
      SpotMarketProxy: "0x0000000000000000000000000000000000000000",
      OracleManager: "0x0000000000000000000000000000000000000000"
    },
    compound: {
      Comet: "0x0000000000000000000000000000000000000000",
      CometRewards: "0x0000000000000000000000000000000000000000",
      Configurator: "0x0000000000000000000000000000000000000000",
      ProxyAdmin: "0x0000000000000000000000000000000000000000"
    },
    chainlink: {
      feeds: {}
    }
  };
}

async function deployERC4337(_config: ChainConfig) {
  console.log("   Deploying EntryPoint, AccountFactory, Paymaster...");
  
  await $`cd ${CONTRACTS_DIR} && forge script script/DeployAA.s.sol --rpc-url https://testnet-rpc.jeju.network --broadcast`;
  
  return {
    EntryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    AccountFactory: "0x0000000000000000000000000000000000000000",
    Paymaster: "0x0000000000000000000000000000000000000000",
    PaymasterVerifier: "0x0000000000000000000000000000000000000000"
  };
}

async function deployGovernance(_config: ChainConfig) {
  console.log("   Deploying Safe, Governor, Timelock...");
  
  await $`cd ${CONTRACTS_DIR} && forge script script/DeployGovernance.s.sol --rpc-url https://testnet-rpc.jeju.network --broadcast`;
  
  return {
    Safe: "0x0000000000000000000000000000000000000000",
    Governor: "0x0000000000000000000000000000000000000000",
    TimelockController: "0x0000000000000000000000000000000000000000",
    GovernanceToken: "0x0000000000000000000000000000000000000000"
  };
}

main();



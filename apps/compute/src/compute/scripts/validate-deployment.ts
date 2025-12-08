/**
 * Validate Compute Marketplace Deployment
 *
 * This script validates that all compute marketplace contracts are deployed
 * and functioning correctly on the target network.
 */

import { Contract, formatEther, JsonRpcProvider } from 'ethers';

// Contract ABIs (minimal for validation)
const REGISTRY_ABI = [
  'function version() view returns (string)',
  'function MIN_PROVIDER_STAKE() view returns (uint256)',
  'function getActiveProviderCount() view returns (uint256)',
];

const LEDGER_ABI = [
  'function version() view returns (string)',
  'function MIN_DEPOSIT() view returns (uint256)',
  'function registry() view returns (address)',
];

const INFERENCE_ABI = [
  'function version() view returns (string)',
  'function registry() view returns (address)',
  'function ledger() view returns (address)',
];

const STAKING_ABI = [
  'function version() view returns (string)',
  'function MIN_USER_STAKE() view returns (uint256)',
  'function MIN_PROVIDER_STAKE() view returns (uint256)',
  'function MIN_GUARDIAN_STAKE() view returns (uint256)',
  'function getGuardianCount() view returns (uint256)',
];

const BAN_MANAGER_ABI = [
  'function version() view returns (string)',
  'function governance() view returns (address)',
];

interface DeploymentConfig {
  rpcUrl: string;
  contracts: {
    registry: string;
    ledger: string;
    inference: string;
    staking: string;
    banManager: string;
  };
}

interface ValidationResult {
  valid: boolean;
  contract: string;
  address: string;
  details: Record<string, string | number | boolean>;
  error?: string;
}

// Helper to call contract methods safely
async function callContract<T>(
  contract: Contract,
  method: string,
  ...args: unknown[]
): Promise<T> {
  const fn = contract.getFunction(method);
  return fn(...args) as Promise<T>;
}

async function validateContract(
  provider: JsonRpcProvider,
  name: string,
  address: string,
  abi: string[]
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: false,
    contract: name,
    address,
    details: {},
  };

  // Check if contract exists
  const code = await provider.getCode(address);
  if (code === '0x') {
    result.error = 'No contract at address';
    return result;
  }

  const contract = new Contract(address, abi, provider);

  // Try to call version()
  try {
    const version = await callContract<string>(contract, 'version');
    result.details.version = version;
    result.valid = true;
  } catch (e) {
    result.error = `Failed to call version(): ${e}`;
    return result;
  }

  return result;
}

async function validateRegistry(
  provider: JsonRpcProvider,
  address: string
): Promise<ValidationResult> {
  const result = await validateContract(
    provider,
    'ComputeRegistry',
    address,
    REGISTRY_ABI
  );

  if (result.valid) {
    const contract = new Contract(address, REGISTRY_ABI, provider);
    const minStake = await callContract<bigint>(contract, 'MIN_PROVIDER_STAKE');
    const activeProviders = await callContract<bigint>(
      contract,
      'getActiveProviderCount'
    );

    result.details.minProviderStake = formatEther(minStake);
    result.details.activeProviders = Number(activeProviders);
  }

  return result;
}

async function validateLedger(
  provider: JsonRpcProvider,
  address: string,
  expectedRegistry: string
): Promise<ValidationResult> {
  const result = await validateContract(
    provider,
    'LedgerManager',
    address,
    LEDGER_ABI
  );

  if (result.valid) {
    const contract = new Contract(address, LEDGER_ABI, provider);
    const minDeposit = await callContract<bigint>(contract, 'MIN_DEPOSIT');
    const registryAddr = await callContract<string>(contract, 'registry');

    result.details.minDeposit = formatEther(minDeposit);
    result.details.registry = registryAddr;
    result.details.registryMatches =
      registryAddr.toLowerCase() === expectedRegistry.toLowerCase();
  }

  return result;
}

async function validateInference(
  provider: JsonRpcProvider,
  address: string,
  expectedRegistry: string,
  expectedLedger: string
): Promise<ValidationResult> {
  const result = await validateContract(
    provider,
    'InferenceServing',
    address,
    INFERENCE_ABI
  );

  if (result.valid) {
    const contract = new Contract(address, INFERENCE_ABI, provider);
    const registryAddr = await callContract<string>(contract, 'registry');
    const ledgerAddr = await callContract<string>(contract, 'ledger');

    result.details.registry = registryAddr;
    result.details.ledger = ledgerAddr;
    result.details.registryMatches =
      registryAddr.toLowerCase() === expectedRegistry.toLowerCase();
    result.details.ledgerMatches =
      ledgerAddr.toLowerCase() === expectedLedger.toLowerCase();
  }

  return result;
}

async function validateStaking(
  provider: JsonRpcProvider,
  address: string
): Promise<ValidationResult> {
  const result = await validateContract(
    provider,
    'ComputeStaking',
    address,
    STAKING_ABI
  );

  if (result.valid) {
    const contract = new Contract(address, STAKING_ABI, provider);
    const minUserStake = await callContract<bigint>(contract, 'MIN_USER_STAKE');
    const minProviderStake = await callContract<bigint>(
      contract,
      'MIN_PROVIDER_STAKE'
    );
    const minGuardianStake = await callContract<bigint>(
      contract,
      'MIN_GUARDIAN_STAKE'
    );
    const guardianCount = await callContract<bigint>(
      contract,
      'getGuardianCount'
    );

    result.details.minUserStake = formatEther(minUserStake);
    result.details.minProviderStake = formatEther(minProviderStake);
    result.details.minGuardianStake = formatEther(minGuardianStake);
    result.details.guardianCount = Number(guardianCount);
  }

  return result;
}

async function validateBanManager(
  provider: JsonRpcProvider,
  address: string
): Promise<ValidationResult> {
  const result = await validateContract(
    provider,
    'BanManager',
    address,
    BAN_MANAGER_ABI
  );

  if (result.valid) {
    const contract = new Contract(address, BAN_MANAGER_ABI, provider);
    const governance = await callContract<string>(contract, 'governance');
    result.details.governance = governance;
  }

  return result;
}

export async function validateDeployment(
  config: DeploymentConfig
): Promise<{ allValid: boolean; results: ValidationResult[] }> {
  const provider = new JsonRpcProvider(config.rpcUrl);

  console.log('\n🔍 Validating Compute Marketplace Deployment\n');
  console.log(`Network: ${config.rpcUrl}`);
  console.log('');

  const results: ValidationResult[] = [];

  // Validate each contract
  console.log('Validating ComputeRegistry...');
  results.push(await validateRegistry(provider, config.contracts.registry));

  console.log('Validating LedgerManager...');
  results.push(
    await validateLedger(
      provider,
      config.contracts.ledger,
      config.contracts.registry
    )
  );

  console.log('Validating InferenceServing...');
  results.push(
    await validateInference(
      provider,
      config.contracts.inference,
      config.contracts.registry,
      config.contracts.ledger
    )
  );

  console.log('Validating ComputeStaking...');
  results.push(await validateStaking(provider, config.contracts.staking));

  console.log('Validating BanManager...');
  results.push(await validateBanManager(provider, config.contracts.banManager));

  // Print results
  console.log('\n========== VALIDATION RESULTS ==========\n');

  let allValid = true;
  for (const result of results) {
    const status = result.valid ? '✅' : '❌';
    console.log(`${status} ${result.contract} (${result.address})`);

    if (result.valid) {
      for (const [key, value] of Object.entries(result.details)) {
        console.log(`   ${key}: ${value}`);
      }
    } else {
      console.log(`   Error: ${result.error}`);
      allValid = false;
    }
    console.log('');
  }

  console.log('=========================================');
  console.log(
    `\nOverall: ${allValid ? '✅ All contracts valid' : '❌ Some contracts invalid'}\n`
  );

  return { allValid, results };
}

// Run validation from command line
async function main() {
  // Default to Anvil if no env vars
  const config: DeploymentConfig = {
    rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
    contracts: {
      registry:
        process.env.REGISTRY_ADDRESS ||
        '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      ledger:
        process.env.LEDGER_ADDRESS ||
        '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      inference:
        process.env.INFERENCE_ADDRESS ||
        '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      staking:
        process.env.STAKING_ADDRESS ||
        '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
      banManager:
        process.env.BAN_MANAGER_ADDRESS ||
        '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    },
  };

  const { allValid } = await validateDeployment(config);
  process.exit(allValid ? 0 : 1);
}

main().catch((error) => {
  console.error('Validation failed:', error);
  process.exit(1);
});

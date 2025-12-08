/**
 * Multicoin Paymaster Integration for Indexer
 */

import { ethers } from 'ethers';

const PAYMASTER_FACTORY_ABI = [
  'function getAllPaymasters() external view returns (address[] memory)',
  'function getPaymasterByToken(address token) external view returns (address)',
  'function paymasterStake(address paymaster) external view returns (uint256)',
];

const PAYMASTER_ABI = [
  'function token() external view returns (address)',
];

const MIN_STAKE_THRESHOLD = BigInt(10) * BigInt(10 ** 18);

export interface PaymasterInfo {
  address: string;
  token: string;
  stake: bigint;
  available: boolean;
}

function getProvider() {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error('RPC_URL environment variable is required');
  return new ethers.JsonRpcProvider(rpcUrl);
}

export async function getAvailablePaymasters(minStake: bigint = MIN_STAKE_THRESHOLD): Promise<PaymasterInfo[]> {
  const factoryAddress = process.env.PAYMASTER_FACTORY_ADDRESS;
  if (!factoryAddress) return [];

  const provider = getProvider();
  const factory = new ethers.Contract(factoryAddress, PAYMASTER_FACTORY_ABI, provider);
  const paymasters: string[] = await factory.getAllPaymasters();

  const paymasterDetails = await Promise.all(
    paymasters.map(async (paymasterAddr) => {
      const paymaster = new ethers.Contract(paymasterAddr, PAYMASTER_ABI, provider);
      const [token, stake] = await Promise.all([
        paymaster.token(),
        factory.paymasterStake(paymasterAddr),
      ]);

      return {
        address: paymasterAddr,
        token: token as string,
        stake: stake as bigint,
        available: (stake as bigint) >= minStake,
      };
    })
  );

  return paymasterDetails.filter(pm => pm.available);
}

export async function getPaymasterForToken(tokenAddress: string): Promise<string | null> {
  const factoryAddress = process.env.PAYMASTER_FACTORY_ADDRESS;
  if (!factoryAddress) return null;

  const provider = getProvider();
  const factory = new ethers.Contract(factoryAddress, PAYMASTER_FACTORY_ABI, provider);
  
  const paymaster = await factory.getPaymasterByToken(tokenAddress);
  const stake = await factory.paymasterStake(paymaster);

  return stake >= MIN_STAKE_THRESHOLD ? paymaster : null;
}

export function generatePaymasterData(
  paymasterAddress: string,
  verificationGasLimit: bigint = BigInt(100000),
  postOpGasLimit: bigint = BigInt(50000)
): string {
  return ethers.solidityPacked(
    ['address', 'uint128', 'uint128'],
    [paymasterAddress, verificationGasLimit, postOpGasLimit]
  );
}

export const paymasterService = {
  getAvailablePaymasters,
  getPaymasterForToken,
  generatePaymasterData,
};

/**
 * @fileoverview Contract ABI exports
 * @module @jeju/contracts/abis
 */

// Re-export ABIs with their types
import ERC20AbiJson from '../../abis/ERC20.json';
import ERC20FactoryAbiJson from '../../abis/ERC20Factory.json';
import BazaarAbiJson from '../../abis/Bazaar.json';
import IdentityRegistryAbiJson from '../../abis/IdentityRegistry.json';

import type { Abi } from 'viem';

// Extract and type the ABIs
export const ERC20Abi = ERC20AbiJson.abi as Abi;
export const ERC20FactoryAbi = ERC20FactoryAbiJson.abi as Abi;
export const BazaarAbi = BazaarAbiJson.abi as Abi;
export const IdentityRegistryAbi = IdentityRegistryAbiJson.abi as Abi;

// Export the full JSON files for those who need address + abi
export { ERC20AbiJson, ERC20FactoryAbiJson, BazaarAbiJson, IdentityRegistryAbiJson };

// Common ABI fragments for convenience
export const ERC20ReadAbi = [
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const ERC20WriteAbi = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;


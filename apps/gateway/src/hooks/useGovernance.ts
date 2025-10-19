/**
 * @fileoverview Governance hooks for futarchy system
 * @module gateway/hooks/useGovernance
 */

import { useReadContract, useAccount } from 'wagmi';
import { Address } from 'viem';

const FUTARCHY_GOVERNOR_ABI = [
  {
    type: 'function',
    name: 'getVotingPower',
    inputs: [
      { name: 'participant', type: 'address' },
      { name: 'atBlock', type: 'uint256' }
    ],
    outputs: [{
      name: 'breakdown',
      type: 'tuple',
      components: [
        { name: 'fromNodeStaking', type: 'uint256' },
        { name: 'fromLPPositions', type: 'uint256' },
        { name: 'fromGovernanceLocks', type: 'uint256' },
        { name: 'total', type: 'uint256' }
      ]
    }],
    stateMutability: 'view'
  }
] as const;

export interface VotingPowerBreakdown {
  fromNodeStaking: bigint;
  fromLPPositions: bigint;
  fromGovernanceLocks: bigint;
  total: bigint;
}

export function useVotingPower() {
  const { address: userAddress } = useAccount();
  const governorAddress = (import.meta.env.VITE_FUTARCHY_GOVERNOR_ADDRESS || '0x0000000000000000000000000000000000000000') as Address;
  
  const { data: votingPower } = useReadContract({
    address: governorAddress,
    abi: FUTARCHY_GOVERNOR_ABI,
    functionName: 'getVotingPower',
    args: userAddress ? [userAddress, 0n] : undefined,
  });
  
  return {
    votingPower: votingPower as VotingPowerBreakdown | undefined
  };
}

export function useGovernance() {
  const { votingPower } = useVotingPower();
  
  return {
    votingPower,
    hasVotingPower: votingPower ? votingPower.total > 0n : false
  };
}


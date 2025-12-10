export const TOKENOMICS = {
  name: 'Jeju',
  symbol: 'JEJU',
  decimals: 18,
  
  // Total Supply
  maxSupply: 10_000_000_000n * 10n ** 18n, // 10 billion
  initialSupply: 1_000_000_000n * 10n ** 18n, // 1 billion at launch
  
  // Distribution (percentage of max supply)
  allocation: {
    presale: {
      percent: 10,
      amount: 1_000_000_000n * 10n ** 18n,
      description: 'Public presale allocation',
      vesting: {
        tgePercent: 20, // 20% at TGE
        cliff: 0, // No cliff
        duration: 180 * 24 * 60 * 60, // 180 days linear vesting
      },
    },
    ecosystem: {
      percent: 30,
      amount: 3_000_000_000n * 10n ** 18n,
      description: 'Ecosystem development and grants',
      vesting: {
        tgePercent: 0,
        cliff: 365 * 24 * 60 * 60, // 1 year cliff
        duration: 4 * 365 * 24 * 60 * 60, // 4 years linear vesting
      },
    },
    agentCouncil: {
      percent: 25,
      amount: 2_500_000_000n * 10n ** 18n,
      description: 'Agent Council treasury for network operations',
      vesting: {
        tgePercent: 5,
        cliff: 180 * 24 * 60 * 60, // 6 months cliff
        duration: 5 * 365 * 24 * 60 * 60, // 5 years linear vesting
      },
    },
    team: {
      percent: 15,
      amount: 1_500_000_000n * 10n ** 18n,
      description: 'Team and advisors',
      vesting: {
        tgePercent: 0,
        cliff: 365 * 24 * 60 * 60, // 1 year cliff
        duration: 4 * 365 * 24 * 60 * 60, // 4 years linear vesting
      },
    },
    liquidity: {
      percent: 10,
      amount: 1_000_000_000n * 10n ** 18n,
      description: 'DEX liquidity and market making',
      vesting: {
        tgePercent: 100, // Fully unlocked for liquidity
        cliff: 0,
        duration: 0,
      },
    },
    community: {
      percent: 10,
      amount: 1_000_000_000n * 10n ** 18n,
      description: 'Community rewards and airdrops',
      vesting: {
        tgePercent: 10,
        cliff: 0,
        duration: 3 * 365 * 24 * 60 * 60, // 3 years linear vesting
      },
    },
  },
  
  // Presale Configuration
  presale: {
    softCap: 100n * 10n ** 18n, // 100 ETH
    hardCap: 1000n * 10n ** 18n, // 1000 ETH
    minContribution: 1n * 10n ** 16n, // 0.01 ETH
    maxContribution: 50n * 10n ** 18n, // 50 ETH
    tokenPrice: 5n * 10n ** 13n, // 0.00005 ETH per JEJU ($0.15 at $3k ETH)
    
    // Bonuses
    whitelistBonus: 10, // 10% bonus for whitelist
    volumeBonuses: [
      { minEth: 10, bonus: 5 }, // 5% for 10+ ETH
      { minEth: 5, bonus: 3 },  // 3% for 5+ ETH
      { minEth: 1, bonus: 1 },  // 1% for 1+ ETH
    ],
  },
  
  // Key Dates (timestamps will be set during deployment)
  schedule: {
    whitelistDuration: 7 * 24 * 60 * 60, // 7 days
    publicDuration: 14 * 24 * 60 * 60, // 14 days
    tgeDelay: 7 * 24 * 60 * 60, // 7 days after presale ends
  },
  
  // Utility
  utility: [
    {
      name: 'Governance',
      description: 'Vote on protocol upgrades and network parameters',
      icon: 'vote',
    },
    {
      name: 'Moderation Staking',
      description: 'Stake JEJU to participate in the futarchy-based moderation marketplace',
      icon: 'shield',
    },
    {
      name: 'Network Services',
      description: 'Pay for compute, storage, and other network services via paymaster',
      icon: 'server',
    },
    {
      name: 'Agent Council',
      description: 'All revenue flows to the Agent Council which funds development',
      icon: 'users',
    },
  ],
} as const;

export type TokenomicsAllocation = keyof typeof TOKENOMICS.allocation;

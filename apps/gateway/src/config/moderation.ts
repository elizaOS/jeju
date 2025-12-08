const ZERO = '0x0000000000000000000000000000000000000000';

export const MODERATION_CONTRACTS = {
  BanManager: import.meta.env.VITE_BAN_MANAGER_ADDRESS || ZERO,
  ReputationLabelManager: import.meta.env.VITE_REPUTATION_LABEL_MANAGER_ADDRESS || ZERO,
  ReportingSystem: import.meta.env.VITE_REPORTING_SYSTEM_ADDRESS || ZERO,
  Predimarket: import.meta.env.VITE_PREDIMARKET_ADDRESS || ZERO,
  RegistryGovernance: import.meta.env.VITE_REGISTRY_GOVERNANCE_ADDRESS || ZERO,
  IdentityRegistry: import.meta.env.VITE_IDENTITY_REGISTRY_ADDRESS || ZERO,
} as const;

export const MODERATION_CONFIG = {
  reportBonds: {
    LOW: '0.001',
    MEDIUM: '0.01',
    HIGH: '0.05',
    CRITICAL: '0.1',
  },
  votingPeriods: {
    LOW: 7 * 24 * 3600,
    MEDIUM: 3 * 24 * 3600,
    HIGH: 24 * 3600,
    CRITICAL: 24 * 3600,
  },
} as const;


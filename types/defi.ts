import { z } from 'zod';
import { AddressSchema } from './contracts';

export const TokenSchema = z.object({
  address: AddressSchema,
  name: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  chainId: z.number(),
});
export type Token = z.infer<typeof TokenSchema>;

export const UniswapV4PoolSchema = z.object({
  poolId: z.string(),
  token0: TokenSchema,
  token1: TokenSchema,
  fee: z.number(),
  tickSpacing: z.number(),
  hooks: AddressSchema.optional(),
  sqrtPriceX96: z.string(),
  tick: z.number(),
  liquidity: z.string(),
});
export type UniswapV4Pool = z.infer<typeof UniswapV4PoolSchema>;

export const SynthetixMarketSchema = z.object({
  marketId: z.number(),
  marketName: z.string(),
  marketSymbol: z.string(),
  maxFundingVelocity: z.string(),
  skewScale: z.string(),
  makerFee: z.string(),
  takerFee: z.string(),
  priceFeeds: z.array(AddressSchema),
});
export type SynthetixMarket = z.infer<typeof SynthetixMarketSchema>;

export const CompoundV3MarketSchema = z.object({
  cometAddress: AddressSchema,
  baseToken: TokenSchema,
  collateralTokens: z.array(z.object({
    token: TokenSchema,
    borrowCollateralFactor: z.string(),
    liquidateCollateralFactor: z.string(),
    liquidationFactor: z.string(),
    supplyCap: z.string(),
  })),
  governor: AddressSchema,
  pauseGuardian: AddressSchema,
  baseBorrowMin: z.string(),
  targetReserves: z.string(),
});
export type CompoundV3Market = z.infer<typeof CompoundV3MarketSchema>;

export const ChainlinkFeedSchema = z.object({
  pair: z.string(),
  address: AddressSchema,
  decimals: z.number(),
  heartbeat: z.number(),
  deviation: z.number(),
  latestRound: z.number().optional(),
  latestAnswer: z.string().optional(),
  latestTimestamp: z.number().optional(),
});
export type ChainlinkFeed = z.infer<typeof ChainlinkFeedSchema>;

export const LiquidityPositionSchema = z.object({
  id: z.string(),
  owner: AddressSchema,
  pool: UniswapV4PoolSchema,
  tickLower: z.number(),
  tickUpper: z.number(),
  liquidity: z.string(),
  token0Amount: z.string(),
  token1Amount: z.string(),
});
export type LiquidityPosition = z.infer<typeof LiquidityPositionSchema>;

export const PerpPositionSchema = z.object({
  accountId: z.number(),
  marketId: z.number(),
  size: z.string(),
  entryPrice: z.string(),
  leverage: z.string(),
  margin: z.string(),
  unrealizedPnl: z.string(),
  liquidationPrice: z.string(),
});
export type PerpPosition = z.infer<typeof PerpPositionSchema>;

export const LendingPositionSchema = z.object({
  account: AddressSchema,
  comet: AddressSchema,
  collateral: z.array(z.object({
    token: AddressSchema,
    balance: z.string(),
    valueUsd: z.string(),
  })),
  borrowed: z.string(),
  borrowedUsd: z.string(),
  borrowCapacity: z.string(),
  liquidationThreshold: z.string(),
  healthFactor: z.string(),
});
export type LendingPosition = z.infer<typeof LendingPositionSchema>;

export const DeFiProtocolConfigSchema = z.object({
  uniswapV4: z.object({
    enabled: z.boolean(),
    poolsToInitialize: z.array(z.object({
      token0: AddressSchema,
      token1: AddressSchema,
      fee: z.number(),
      tickSpacing: z.number(),
      hooks: AddressSchema.optional(),
      initialPrice: z.string(),
    })),
  }),
  synthetixV3: z.object({
    enabled: z.boolean(),
    marketsToCreate: z.array(z.object({
      marketName: z.string(),
      marketSymbol: z.string(),
      maxFundingVelocity: z.string(),
      skewScale: z.string(),
      makerFee: z.string(),
      takerFee: z.string(),
      priceFeeds: z.array(AddressSchema),
    })),
  }),
  compoundV3: z.object({
    enabled: z.boolean(),
    marketsToCreate: z.array(z.object({
      baseToken: AddressSchema,
      collateralTokens: z.array(z.object({
        token: AddressSchema,
        borrowCollateralFactor: z.string(),
        liquidateCollateralFactor: z.string(),
        liquidationFactor: z.string(),
        supplyCap: z.string(),
      })),
      governor: AddressSchema,
      pauseGuardian: AddressSchema,
      baseBorrowMin: z.string(),
      targetReserves: z.string(),
    })),
  }),
});
export type DeFiProtocolConfig = z.infer<typeof DeFiProtocolConfigSchema>;



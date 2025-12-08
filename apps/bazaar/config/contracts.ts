import { Address } from 'viem'
import { JEJU_CHAIN_ID } from './chains'

import v4Deployment from '../../../contracts/deployments/uniswap-v4-1337.json'
import factoryDeployment from '../../../contracts/deployments/erc20-factory-1337.json'
import marketplaceDeployment from '../../../contracts/deployments/bazaar-marketplace-1337.json'

export interface V4Contracts {
  poolManager: Address
  weth: Address
  swapRouter?: Address
  positionManager?: Address
  quoterV4?: Address
  stateView?: Address
}

export interface NFTContracts {
  hyperscapeItems?: Address
  hyperscapeGold?: Address
  marketplace?: Address
  tradeEscrow?: Address
  gameAgentId?: number
}

export interface TokenFactoryContracts {
  erc20Factory: Address
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address

export const V4_CONTRACTS: Record<number, V4Contracts> = {
  1337: {
    poolManager: ((v4Deployment as Record<string, string>).poolManager || ZERO_ADDRESS) as Address,
    weth: v4Deployment.weth as Address,
    swapRouter: v4Deployment.swapRouter as Address,
    positionManager: v4Deployment.positionManager as Address,
    quoterV4: v4Deployment.quoterV4 as Address,
    stateView: v4Deployment.stateView as Address,
  },
  420691: {
    poolManager: ((v4Deployment as Record<string, string>).poolManager || ZERO_ADDRESS) as Address,
    weth: v4Deployment.weth as Address,
    swapRouter: v4Deployment.swapRouter as Address,
    positionManager: v4Deployment.positionManager as Address,
    quoterV4: v4Deployment.quoterV4 as Address,
    stateView: v4Deployment.stateView as Address,
  },
}

const marketplaceData = marketplaceDeployment as Record<string, string>

export const NFT_CONTRACTS: Record<number, NFTContracts> = {
  1337: {
    marketplace: (marketplaceData.marketplace || marketplaceData.at || ZERO_ADDRESS) as Address,
    hyperscapeGold: (marketplaceData.goldToken || marketplaceData.Token || ZERO_ADDRESS) as Address,
    hyperscapeItems: (marketplaceData.marketplace || marketplaceData.at || ZERO_ADDRESS) as Address,
  },
  [JEJU_CHAIN_ID]: {
    marketplace: (marketplaceData.marketplace || marketplaceData.at || ZERO_ADDRESS) as Address,
    hyperscapeGold: (marketplaceData.goldToken || marketplaceData.Token || ZERO_ADDRESS) as Address,
    hyperscapeItems: (marketplaceData.marketplace || marketplaceData.at || ZERO_ADDRESS) as Address,
  },
}

const factoryData = factoryDeployment as Record<string, string>

export const TOKEN_FACTORY_CONTRACTS: Record<number, TokenFactoryContracts> = {
  1337: {
    erc20Factory: (factoryData.factory || factoryData.at || ZERO_ADDRESS) as Address,
  },
  [JEJU_CHAIN_ID]: {
    erc20Factory: (factoryData.factory || factoryData.at || ZERO_ADDRESS) as Address,
  },
}

export function getV4Contracts(chainId: number): V4Contracts {
  const contracts = V4_CONTRACTS[chainId]
  if (!contracts) {
    throw new Error(`V4 contracts not configured for chain ${chainId}`)
  }
  return contracts
}

export function getNFTContracts(chainId: number): NFTContracts {
  return NFT_CONTRACTS[chainId] || {}
}

export function hasV4Periphery(chainId: number): boolean {
  const contracts = getV4Contracts(chainId)
  return !!(contracts.swapRouter && contracts.positionManager && contracts.quoterV4)
}

export function hasNFTMarketplace(chainId: number): boolean {
  const contracts = getNFTContracts(chainId)
  return !!(contracts.marketplace && contracts.hyperscapeItems)
}

export function getTokenFactoryContracts(chainId: number): TokenFactoryContracts | undefined {
  return TOKEN_FACTORY_CONTRACTS[chainId]
}

export function hasTokenFactory(chainId: number): boolean {
  const contracts = getTokenFactoryContracts(chainId)
  return !!contracts?.erc20Factory
}


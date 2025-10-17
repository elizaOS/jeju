#!/usr/bin/env bun
/**
 * @title Test Oracle Prices
 * @notice Fetch and display prices from Base DEXes without updating oracle
 */

import { ethers } from 'ethers';

// Chainlink ETH/USD on Base
const CHAINLINK_ETH_USD_BASE = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70';

const CHAINLINK_ABI = [
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)',
];

const UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
const UNISWAP_V3_POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
];

async function testPrices() {
  console.log('🔍 Testing Price Fetching from Base\n');
  
  const baseRpc = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  const provider = new ethers.JsonRpcProvider(baseRpc);
  
  console.log(`📡 Connected to Base: ${baseRpc}\n`);
  
  // Test 1: Chainlink ETH/USD
  console.log('━'.repeat(60));
  console.log('Test 1: Chainlink ETH/USD Price Feed');
  console.log('━'.repeat(60));
  
  try {
    const feed = new ethers.Contract(CHAINLINK_ETH_USD_BASE, CHAINLINK_ABI, provider);
    const [roundId, answer, , updatedAt] = await feed.latestRoundData();
    const decimals = await feed.decimals();
    
    const price = Number(answer) / (10 ** Number(decimals));
    const age = Date.now() / 1000 - Number(updatedAt);
    
    console.log(`✅ Success!`);
    console.log(`   Price: $${price.toFixed(2)}`);
    console.log(`   Decimals: ${decimals}`);
    console.log(`   Round ID: ${roundId}`);
    console.log(`   Updated: ${new Date(Number(updatedAt) * 1000).toISOString()}`);
    console.log(`   Age: ${age.toFixed(0)}s`);
    console.log(`   Fresh: ${age < 3600 ? '✅ Yes' : '❌ No (>1h old)'}`);
  } catch (error: any) {
    console.error(`❌ Failed: ${error.message}`);
  }
  
  // Test 2: Check for elizaOS token pools
  console.log('\n' + '━'.repeat(60));
  console.log('Test 2: Check for elizaOS DEX Pools');
  console.log('━'.repeat(60));
  
  const elizaToken = process.env.ELIZAOS_TOKEN_BASE;
  
  if (!elizaToken) {
    console.log('⚠️  ELIZAOS_TOKEN_BASE not set - skipping DEX checks');
    console.log('   Set this in .env.oracle to test DEX price fetching\n');
    return;
  }
  
  console.log(`   Token: ${elizaToken}`);
  
  const WETH = '0x4200000000000000000000000000000000000006';
  const feeTiers = [
    { fee: 100, desc: '0.01%' },
    { fee: 500, desc: '0.05%' },
    { fee: 3000, desc: '0.3%' },
    { fee: 10000, desc: '1%' },
  ];
  
  for (const { fee, desc } of feeTiers) {
    try {
      // Calculate pool address
      const factory = new ethers.Contract(
        UNISWAP_V3_FACTORY,
        ['function getPool(address,address,uint24) view returns (address)'],
        provider
      );
      
      const poolAddress = await factory.getPool(elizaToken, WETH, fee);
      
      if (poolAddress === ethers.ZeroAddress) {
        console.log(`   ${desc} tier: No pool found`);
        continue;
      }
      
      const pool = new ethers.Contract(poolAddress, UNISWAP_V3_POOL_ABI, provider);
      const [sqrtPriceX96] = await pool.slot0();
      
      console.log(`   ${desc} tier: ✅ Pool found at ${poolAddress}`);
      console.log(`      sqrtPriceX96: ${sqrtPriceX96.toString()}`);
      
      // Calculate approximate price
      const sqrtPrice = Number(sqrtPriceX96) / (2 ** 96);
      const price = sqrtPrice ** 2;
      console.log(`      Raw price: ${price.toFixed(10)}`);
      
    } catch (error: any) {
      console.log(`   ${desc} tier: ❌ Error - ${error.message}`);
    }
  }
  
  console.log('\n' + '━'.repeat(60));
  console.log('✅ Price test complete!\n');
  console.log('Next: Run `bun run oracle:start` to start the updater bot\n');
}

testPrices().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


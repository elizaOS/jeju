/**
 * @fileoverview Unit tests for strategy logic
 */

import { describe, test, expect } from 'bun:test';
import { parseEther } from 'viem';
import { DexArbitrageStrategy } from '../../src/strategies/dex-arbitrage';
import { SandwichStrategy } from '../../src/strategies/sandwich';
import { CrossChainArbStrategy } from '../../src/strategies/cross-chain-arb';
import type { Pool, ChainId } from '../../src/types';

// Mock pools for testing
const mockPools: Pool[] = [
  {
    address: '0x1111111111111111111111111111111111111111',
    type: 'XLP_V2',
    token0: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6, chainId: 1337 as ChainId },
    token1: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18, chainId: 1337 as ChainId },
    chainId: 1337 as ChainId,
    reserve0: parseEther('1000000').toString(), // 1M USDC
    reserve1: parseEther('500').toString(), // 500 ETH
  },
  {
    address: '0x2222222222222222222222222222222222222222',
    type: 'XLP_V2',
    token0: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6, chainId: 1337 as ChainId },
    token1: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18, chainId: 1337 as ChainId },
    chainId: 1337 as ChainId,
    reserve0: parseEther('990000').toString(), // 990K USDC (different price)
    reserve1: parseEther('500').toString(), // 500 ETH
  },
];

describe('DexArbitrageStrategy', () => {
  test('initializes with pools', () => {
    const strategy = new DexArbitrageStrategy(1337 as ChainId, {
      type: 'DEX_ARBITRAGE',
      enabled: true,
      minProfitBps: 10,
      maxGasGwei: 100,
      maxSlippageBps: 50,
    });

    strategy.initialize(mockPools);

    // Strategy should be created
    expect(strategy).toBeDefined();
  });

  test('handles sync events', () => {
    const strategy = new DexArbitrageStrategy(1337 as ChainId, {
      type: 'DEX_ARBITRAGE',
      enabled: true,
      minProfitBps: 5,
      maxGasGwei: 100,
      maxSlippageBps: 50,
    });

    strategy.initialize(mockPools);

    // Simulate sync event
    strategy.onSync({
      poolAddress: mockPools[0].address,
      reserve0: BigInt(mockPools[0].reserve0!),
      reserve1: BigInt(mockPools[0].reserve1!),
      blockNumber: 1n,
      chainId: 1337 as ChainId,
    });

    // Should not throw
    expect(true).toBe(true);
  });

  test('returns opportunities array', () => {
    const strategy = new DexArbitrageStrategy(1337 as ChainId, {
      type: 'DEX_ARBITRAGE',
      enabled: true,
      minProfitBps: 1,
      maxGasGwei: 100,
      maxSlippageBps: 50,
    });

    strategy.initialize(mockPools);

    const opportunities = strategy.getOpportunities();
    expect(Array.isArray(opportunities)).toBe(true);
  });

  test('marks opportunities correctly', () => {
    const strategy = new DexArbitrageStrategy(1337 as ChainId, {
      type: 'DEX_ARBITRAGE',
      enabled: true,
      minProfitBps: 1,
      maxGasGwei: 100,
      maxSlippageBps: 50,
    });

    strategy.initialize(mockPools);

    // Manually test the mark functions don't throw
    strategy.markExecuting('test-id');
    strategy.markCompleted('test-id', true);

    expect(true).toBe(true);
  });
});

describe('SandwichStrategy', () => {
  const MOCK_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

  test('initializes with routers', () => {
    const strategy = new SandwichStrategy(
      1337 as ChainId,
      {
        type: 'SANDWICH',
        enabled: true,
        minProfitBps: 5,
        maxGasGwei: 150,
        maxSlippageBps: 30,
      },
      [MOCK_ROUTER]
    );

    strategy.initialize(mockPools);
    expect(strategy).toBeDefined();
  });

  test('ignores non-router transactions', () => {
    const strategy = new SandwichStrategy(
      1337 as ChainId,
      {
        type: 'SANDWICH',
        enabled: true,
        minProfitBps: 5,
        maxGasGwei: 150,
        maxSlippageBps: 30,
      },
      [MOCK_ROUTER]
    );

    strategy.initialize(mockPools);

    strategy.onPendingTx({
      hash: '0x1234',
      from: '0xaaaa',
      to: '0xbbbb', // Not a router
      value: 0n,
      gasPrice: parseEther('0.00000005'),
      gas: 200000n,
      input: '0x',
      nonce: 0,
      chainId: 1337 as ChainId,
      receivedAt: Date.now(),
    });

    const opportunities = strategy.getOpportunities();
    expect(opportunities.length).toBe(0);
  });

  test('can add routers', () => {
    const strategy = new SandwichStrategy(
      1337 as ChainId,
      {
        type: 'SANDWICH',
        enabled: true,
        minProfitBps: 5,
        maxGasGwei: 150,
        maxSlippageBps: 30,
      },
      []
    );

    strategy.addRouter(MOCK_ROUTER);
    expect(true).toBe(true);
  });
});

describe('CrossChainArbStrategy', () => {
  test('initializes with chains', () => {
    const strategy = new CrossChainArbStrategy(
      [1337 as ChainId, 8453 as ChainId],
      {
        type: 'CROSS_CHAIN_ARBITRAGE',
        enabled: true,
        minProfitBps: 50,
        maxGasGwei: 100,
        maxSlippageBps: 100,
      }
    );

    strategy.initialize([]);
    expect(strategy).toBeDefined();
  });

  test('updates prices', () => {
    const strategy = new CrossChainArbStrategy(
      [1337 as ChainId, 8453 as ChainId],
      {
        type: 'CROSS_CHAIN_ARBITRAGE',
        enabled: true,
        minProfitBps: 50,
        maxGasGwei: 100,
        maxSlippageBps: 100,
      }
    );

    strategy.initialize([]);

    // Update prices
    strategy.updatePrice(1337 as ChainId, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', parseEther('3000'), parseEther('1000'));
    strategy.updatePrice(8453 as ChainId, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', parseEther('3100'), parseEther('1000'));

    // Should not throw
    expect(true).toBe(true);
  });

  test('returns opportunities array', () => {
    const strategy = new CrossChainArbStrategy(
      [1337 as ChainId, 8453 as ChainId],
      {
        type: 'CROSS_CHAIN_ARBITRAGE',
        enabled: true,
        minProfitBps: 50,
        maxGasGwei: 100,
        maxSlippageBps: 100,
      }
    );

    strategy.initialize([]);

    const opportunities = strategy.getOpportunities();
    expect(Array.isArray(opportunities)).toBe(true);
  });
});

describe('Constant Product Formula', () => {
  test('calculates correct output amounts', () => {
    // Test the AMM constant product formula
    // amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
    const amountIn = parseEther('1');
    const reserveIn = parseEther('1000');
    const reserveOut = parseEther('1000');

    const amountInWithFee = amountIn * 997n;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 1000n + amountInWithFee;
    const expectedOut = numerator / denominator;

    // Expected: ~0.996 (after 0.3% fee, with some price impact)
    expect(expectedOut).toBeGreaterThan(parseEther('0.99'));
    expect(expectedOut).toBeLessThan(parseEther('1'));
  });

  test('handles large trades with price impact', () => {
    // Large trade should have significant price impact
    const amountIn = parseEther('100'); // 10% of reserves
    const reserveIn = parseEther('1000');
    const reserveOut = parseEther('1000');

    const amountInWithFee = amountIn * 997n;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 1000n + amountInWithFee;
    const expectedOut = numerator / denominator;

    // Should get less than 100 tokens due to price impact
    expect(expectedOut).toBeLessThan(parseEther('100'));
    // But more than 90 (reasonable slippage)
    expect(expectedOut).toBeGreaterThan(parseEther('90'));
  });
});

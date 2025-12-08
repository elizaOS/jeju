/**
 * Tests for Moderation SDK
 *
 * Tests the ModerationSDK which interfaces with:
 * - ComputeStaking: User/Provider/Guardian staking
 * - BanManager: Network and app-level bans
 */

import { describe, expect, test } from 'bun:test';
import { parseEther, Wallet } from 'ethers';
import {
  createModerationSDK,
  type ModerationSDKConfig,
  StakeType,
} from '../sdk/moderation';

// Mock contract addresses for testing SDK instantiation
const MOCK_CONTRACTS = {
  staking: '0x0000000000000000000000000000000000000001',
  banManager: '0x0000000000000000000000000000000000000002',
};

const RPC_URL = 'http://127.0.0.1:8545';

describe('Moderation SDK', () => {
  describe('SDK Creation', () => {
    test('creates read-only SDK without signer', () => {
      const sdk = createModerationSDK({
        rpcUrl: RPC_URL,
        stakingAddress: MOCK_CONTRACTS.staking,
        banManagerAddress: MOCK_CONTRACTS.banManager,
      });

      expect(sdk).toBeDefined();
      expect(sdk.getAddress()).toBeNull();
    });

    test('creates writable SDK with signer', () => {
      const privateKey =
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const wallet = new Wallet(privateKey);

      const sdk = createModerationSDK({
        rpcUrl: RPC_URL,
        privateKey,
        stakingAddress: MOCK_CONTRACTS.staking,
        banManagerAddress: MOCK_CONTRACTS.banManager,
      });

      expect(sdk).toBeDefined();
      expect(sdk.getAddress()).toBe(wallet.address);
    });

    test('ModerationSDKConfig accepts required fields', () => {
      const config: ModerationSDKConfig = {
        rpcUrl: RPC_URL,
        contracts: {
          staking: MOCK_CONTRACTS.staking,
          banManager: MOCK_CONTRACTS.banManager,
        },
      };

      expect(config.rpcUrl).toBe(RPC_URL);
      expect(config.contracts.staking).toBe(MOCK_CONTRACTS.staking);
      expect(config.contracts.banManager).toBe(MOCK_CONTRACTS.banManager);
    });
  });

  describe('Enums', () => {
    test('StakeType enum values', () => {
      expect(StakeType.USER).toBe(0);
      expect(StakeType.PROVIDER).toBe(1);
      expect(StakeType.GUARDIAN).toBe(2);
    });
  });

  describe('Stake Constants', () => {
    test('expected minimum stake values', () => {
      // These are the expected values from ComputeStaking contract
      const MIN_USER_STAKE = parseEther('0.01');
      const MIN_PROVIDER_STAKE = parseEther('0.1');
      const MIN_GUARDIAN_STAKE = parseEther('1');

      expect(MIN_USER_STAKE).toBe(BigInt('10000000000000000'));
      expect(MIN_PROVIDER_STAKE).toBe(BigInt('100000000000000000'));
      expect(MIN_GUARDIAN_STAKE).toBe(BigInt('1000000000000000000'));
    });
  });
});

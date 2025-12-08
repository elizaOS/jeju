import { test, expect, describe } from 'bun:test';
import { createPaymentRequirement, PAYMENT_TIERS } from '../../src/lib/x402';
import type { Address } from 'viem';

describe('Gateway x402', () => {
  test('payment tiers defined', () => {
    expect(PAYMENT_TIERS.NODE_REGISTRATION).toBeGreaterThan(0n);
    expect(PAYMENT_TIERS.PAYMASTER_DEPLOYMENT).toBeGreaterThan(0n);
  });

  test('creates payment requirement', () => {
    const testAddress: Address = '0x1234567890123456789012345678901234567890';
    const req = createPaymentRequirement('/a2a', PAYMENT_TIERS.NODE_REGISTRATION, 'Node fee', testAddress);
    expect(req.x402Version).toBe(1);
    expect(req.accepts[0].description).toBe('Node fee');
  });
});


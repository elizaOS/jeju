# Synpress Wallet Tests - Known Gaps

## ⚠️ CRITICAL: Cannot Fully Test Without Deployed Contracts

### Why Some Tests Are Impossible Without Contracts:

#### 1. **Actual Trading Execution** ❌ BLOCKED
```typescript
// CANNOT TEST until contracts deployed:
test('should execute trade and confirm in MetaMask', async ({ }) => {
  await buyButton.click();
  await metamask.confirmTransaction(); // ← FAILS: no contract to call
});
```
**Reason**: Predimarket contract not deployed yet

#### 2. **Token Approval Flow** ❌ BLOCKED
```typescript
// CANNOT TEST until contracts deployed:
test('should approve token before trading', async ({ }) => {
  await approveButton.click();
  await metamask.confirmTransaction(); // ← FAILS: no token/contract
});
```
**Reason**: ERC20 token and Predimarket contracts needed

#### 3. **Claim Winnings** ❌ BLOCKED
```typescript
// CANNOT TEST until contracts deployed:
test('should claim winnings', async ({ }) => {
  await claimButton.click();
  await metamask.confirmTransaction(); // ← FAILS: no contract
});
```
**Reason**: Need resolved markets with winnings

---

## ✅ What CAN Be Tested Now (UI/UX Only)

### Currently Implemented (06-trading-full-flow.spec.ts):
1. ✅ Navigate to market detail
2. ✅ Select YES outcome button (UI state)
3. ✅ Select NO outcome button (UI state)
4. ✅ Enter bet amount (input validation)
5. ✅ See buy button when connected
6. ✅ Display all trading interface components

### Currently Implemented (07-market-search.spec.ts):
1. ✅ Search markets by text
2. ✅ Clear search results
3. ✅ Filter by status (all/active/resolved)

### Currently Implemented (08-portfolio-positions.spec.ts):
1. ✅ Display portfolio stats
2. ✅ Show positions table or empty state
3. ✅ Navigate to market from position
4. ✅ Display claim buttons (UI only)
5. ✅ Calculate P&L display

---

## 🎯 What to Test After Contract Deployment

### Priority 1: End-to-End Trading
```typescript
// tests/wallet/09-trading-e2e.spec.ts
test('should execute complete YES bet', async ({ metamask }) => {
  await page.goto('/markets');
  await marketCard.first().click();
  await yesButton.click();
  await amountInput.fill('0.1');
  await buyButton.click();
  await metamask.confirmTransaction(); // ← REAL TRANSACTION
  await page.waitForSelector('[data-testid="success-toast"]');
});

test('should handle transaction rejection', async ({ metamask }) => {
  await buyButton.click();
  await metamask.rejectTransaction(); // ← REAL REJECTION
  await expect(errorMessage).toBeVisible();
});
```

### Priority 2: Approval Flow
```typescript
// tests/wallet/10-token-approval.spec.ts
test('should approve token before first trade', async ({ metamask }) => {
  await page.goto('/markets/[market-requiring-approval]');
  await expect(approveButton).toBeVisible();
  await approveButton.click();
  await metamask.confirmTransaction(); // ← REAL APPROVAL
  await expect(approveButton).not.toBeVisible();
  await expect(buyButton).toBeEnabled();
});
```

### Priority 3: Claim Flow
```typescript
// tests/wallet/11-claim-winnings.spec.ts
test('should claim winnings from resolved market', async ({ metamask }) => {
  await page.goto('/portfolio');
  await claimButton.first().click();
  await metamask.confirmTransaction(); // ← REAL CLAIM
  await expect(successToast).toBeVisible();
  await expect(positionStatus).toHaveText('Claimed');
});
```

---

## 📊 Current vs. Target Coverage

| Test Type | Current | After Contracts | Gap |
|-----------|---------|-----------------|-----|
| **UI Navigation** | 100% ✅ | 100% | None |
| **Form Interactions** | 100% ✅ | 100% | None |
| **Button States** | 100% ✅ | 100% | None |
| **MetaMask Transactions** | 0% ❌ | 100% | **ALL** |
| **Transaction Confirmation** | 0% ❌ | 100% | **ALL** |
| **Transaction Rejection** | 0% ❌ | 100% | **ALL** |
| **Position Updates** | 0% ❌ | 100% | **ALL** |
| **Claim Payouts** | 0% ❌ | 100% | **ALL** |

---

## 🚨 Why This Matters

### Current Tests Verify:
✅ UI renders correctly
✅ Buttons are clickable
✅ Forms accept input
✅ Navigation works
✅ Wallet connects

### Current Tests DO NOT Verify:
❌ Trades actually execute
❌ Positions are created
❌ Balances update
❌ Claims pay out
❌ Approvals grant access
❌ Transactions can be rejected
❌ Error states trigger correctly
❌ Smart contract interactions work

---

## 🎯 Recommended Approach

### Phase 1: NOW (Without Contracts) ✅ DONE
- Test UI/UX with wallet connected
- Test navigation flows
- Test form interactions
- Test button states
- Test display logic

### Phase 2: AFTER CONTRACT DEPLOYMENT (Required)
- Test actual MetaMask transactions
- Test transaction confirmations
- Test transaction rejections
- Test position creation
- Test claim payouts
- Test approval flows
- Test error scenarios

---

## 📝 Test Files Summary

### Implemented Now:
- `05-markets.spec.ts` - 8 tests (navigation/display)
- `06-trading-full-flow.spec.ts` - 6 tests (UI interactions)
- `07-market-search.spec.ts` - 3 tests (search/filter)
- `08-portfolio-positions.spec.ts` - 5 tests (portfolio display)

**Total**: 22 tests, all UI/UX only

### Need After Deployment:
- `09-trading-e2e.spec.ts` - 8 tests (real transactions)
- `10-token-approval.spec.ts` - 4 tests (approval flow)
- `11-claim-winnings.spec.ts` - 4 tests (claim payouts)
- `12-error-scenarios.spec.ts` - 5 tests (failures)

**Total**: 21 additional tests needed for full coverage

---

## ✅ Conclusion

**Current State**: 
- Markets UI/UX fully tested with Synpress ✅
- Navigation and display: 100% coverage ✅
- Wallet interactions: 0% coverage ❌

**Blockers**:
- Cannot test real transactions without deployed contracts
- Cannot test approvals without ERC20 tokens
- Cannot test claims without resolved markets

**Next Steps**:
1. Deploy contracts on localnet
2. Create test markets
3. Add 21 transaction-based Synpress tests
4. Test complete trading journey
5. Test error scenarios

**Current Tests Are Sufficient For**: UI/UX validation, navigation, wallet connection
**Current Tests Are NOT Sufficient For**: Production deployment, financial transactions, user safety




# Gateway Test Implementation Roadmap
## From 35% to 100% Coverage

**Current State**: Basic UI navigation tested, NO transactions tested  
**Target State**: Every feature, flow, and transaction fully tested with real blockchain  

---

## 🚨 CRITICAL PRIORITIES (Do First)

### Priority 1: Transaction Testing Infrastructure
**Files to Create**:
- `tests/synpress/helpers/transaction-helpers.ts` - Approval, signing, confirmation helpers
- `tests/synpress/helpers/blockchain-helpers.ts` - Mine blocks, fast-forward time, snapshots
- `tests/synpress/fixtures/test-data.ts` - Test addresses, amounts, constants

**Why Critical**: ALL transaction tests depend on this infrastructure

### Priority 2: Complete Flow Tests (End-to-End)
**Files to Create**:
1. `tests/synpress/flows/01-complete-token-lifecycle.spec.ts`
   - Register token → Deploy paymaster → Add liquidity → Claim fees → Remove liquidity
   - **Estimated Time**: 2-3 hours to write, 5min to run
   - **Blocker**: None, can start immediately

2. `tests/synpress/flows/02-complete-bridge-flow.spec.ts`
   - Select token → Approve → Bridge → Verify receipt → Check balance
   - **Estimated Time**: 1-2 hours to write, 3min to run
   - **Blocker**: Needs Base bridge mock or testnet setup

3. `tests/synpress/flows/03-complete-node-flow.spec.ts`
   - Register node → Monitor performance → Claim rewards → Deregister
   - **Estimated Time**: 2-3 hours to write, 8min to run (includes 7-day wait simulation)
   - **Blocker**: Needs time-manipulation helpers

4. `tests/synpress/flows/04-complete-app-registry-flow.spec.ts`
   - Register app → Browse → View details → Withdraw stake
   - **Estimated Time**: 1-2 hours to write, 2min to run
   - **Blocker**: None

**Why Critical**: These prove the entire system works end-to-end

### Priority 3: Missing Page Tests
**Files to Create**:
1. `tests/synpress/pages/moderation-dashboard.spec.ts`
   - Submit report → Upload evidence → Vote → Execute ban
2. `tests/synpress/pages/storage-manager.spec.ts`
   - Upload file → View files → Renew storage → Fund balance
3. `tests/synpress/pages/agent-profile.spec.ts`
   - View agent → Check reputation → View reports → Appeal ban

**Why Critical**: These pages exist but have ZERO test coverage

---

## 📅 Week-by-Week Implementation Plan

### **Week 1: Foundation & Critical Flows**
**Days 1-2**: Transaction Infrastructure
- Create transaction-helpers.ts
- Create blockchain-helpers.ts
- Create test-data.ts
- Test the helpers themselves

**Days 3-4**: Complete Flow Tests
- Implement complete-token-lifecycle.spec.ts
- Implement complete-node-flow.spec.ts
- Run and debug until passing

**Day 5**: Bridge & Registry Flows
- Implement complete-bridge-flow.spec.ts
- Implement complete-app-registry-flow.spec.ts
- Integration testing

### **Week 2: Feature Coverage**
**Days 1-2**: Transaction Tests
- Token registration transactions
- Paymaster deployment transactions
- Liquidity operations (add, remove, claim)
- Node operations (register, claim, deregister)

**Days 3-4**: Missing Pages
- Moderation dashboard tests
- Storage manager tests
- Agent profile tests

**Day 5**: Governance & Advanced Features
- Governance quest creation
- Futarchy voting
- Parameter changes

### **Week 3: Polish & Edge Cases**
**Days 1-2**: Error States
- All validation errors
- Transaction failures
- Network errors
- Timeout handling

**Days 3-4**: Edge Cases & Multi-Token
- Empty states
- Large datasets
- All 4 tokens tested equally
- Cross-token operations

**Day 5**: Final Testing
- Full regression suite
- Performance testing
- CI/CD integration
- Documentation

---

## 🛠️ Implementation Details

### Transaction Test Pattern

```typescript
// Example: Test token registration with real transaction
test('should register new token with transaction', async ({ page, metamask }) => {
  await page.goto(GATEWAY_URL);
  await connectWallet(page, metamask);
  
  // Navigate to register form
  await page.getByRole('button', { name: /Registered Tokens/i }).click();
  
  // Fill form
  await page.getByPlaceholder('0x...').fill(TEST_TOKEN_ADDRESS);
  await page.locator('input[placeholder="0"]').fill('0');
  await page.locator('input[placeholder="200"]').fill('200');
  
  // Submit (triggers transaction)
  await page.getByRole('button', { name: /Register Token/i }).click();
  
  // Approve in MetaMask
  await metamask.confirmTransaction();
  
  // Wait for success
  await expect(page.getByText(/registered successfully/i)).toBeVisible({ timeout: 30000 });
  
  // Verify token in list
  await expect(page.getByText(TEST_TOKEN_SYMBOL)).toBeVisible();
  
  console.log('✅ Token registration transaction complete');
});
```

### Time Manipulation Pattern

```typescript
// Fast-forward 7 days for node deregistration
import { mineBlocks, increaseTime } from '../helpers/blockchain-helpers';

test('should deregister node after 7 days', async ({ page, metamask }) => {
  // Register node first...
  
  // Fast-forward 7 days
  const publicClient = getPublicClient();
  await increaseTime(publicClient, 7 * 24 * 60 * 60);
  
  // Now deregister should work
  await page.getByRole('button', { name: /Deregister/i }).click();
  await metamask.confirmTransaction();
  await expect(page.getByText(/deregistered successfully/i)).toBeVisible();
});
```

### Multi-Token Test Pattern

```typescript
// Test feature with ALL 4 tokens
const PROTOCOL_TOKENS = ['elizaOS', 'CLANKER', 'VIRTUAL', 'CLANKERMON'];

for (const token of PROTOCOL_TOKENS) {
  test(`should deploy paymaster for ${token}`, async ({ page, metamask }) => {
    // ... test logic
  });
}
```

---

## 🎬 Quick Start

### Run Existing Tests
```bash
cd apps/gateway
bun run test:e2e:smoke        # 2min - verify setup works
```

### Start New Test Development
```bash
# 1. Create transaction helpers
touch tests/synpress/helpers/transaction-helpers.ts
touch tests/synpress/helpers/blockchain-helpers.ts

# 2. Create first complete flow test
touch tests/synpress/flows/01-complete-token-lifecycle.spec.ts

# 3. Run in development mode
bun run test:e2e:headed tests/synpress/flows/01-complete-token-lifecycle.spec.ts
```

---

## 📊 Progress Tracking

Use this checklist to track implementation:

```markdown
## Week 1
- [ ] Transaction helpers created
- [ ] Blockchain helpers created
- [ ] Complete token lifecycle test passing
- [ ] Complete node flow test passing
- [ ] Complete bridge flow test passing
- [ ] Complete app registry flow test passing

## Week 2
- [ ] All transaction types tested
- [ ] Moderation dashboard tested
- [ ] Storage manager tested
- [ ] Agent profile tested
- [ ] Governance quests tested

## Week 3
- [ ] All error states tested
- [ ] All edge cases tested
- [ ] Multi-token equality verified
- [ ] CI/CD pipeline working
- [ ] 100% coverage achieved
```

---

## 🎯 Definition of Done

A test file is "done" when:
✅ All user interactions tested  
✅ All transactions execute successfully  
✅ All success states verified  
✅ All error states tested  
✅ All validations tested  
✅ Screenshots captured  
✅ Console logs clean (no errors)  
✅ Passes in CI/CD  
✅ Documentation complete  

---

## 🆘 Common Blockers & Solutions

### Blocker: "Transaction takes too long"
**Solution**: Use `timeout: 90000` for transaction tests

### Blocker: "MetaMask won't confirm"
**Solution**: Add `await page.waitForTimeout(2000)` before `metamask.confirmTransaction()`

### Blocker: "Balance not updating"
**Solution**: Add explicit refetch or wait for block confirmation

### Blocker: "Contract not deployed"
**Solution**: Check deployment script ran, addresses in .env

### Blocker: "Tests fail in CI but pass locally"
**Solution**: Check headless mode differences, ensure proper waits

---

## 📞 Need Help?

1. Check existing test files for patterns
2. Review Synpress docs: https://synpress.io
3. Check helper functions in tests/shared/
4. Run tests in headed mode with --debug
5. Review screenshots of failures
6. Check Playwright trace files

---

## 🎉 Completion Criteria

When this roadmap is complete:
- ✅ 100+ test files covering all features
- ✅ 500+ individual test cases
- ✅ Every transaction type tested
- ✅ Every UX path validated
- ✅ CI/CD pipeline green
- ✅ Production-ready confidence

**Estimated Total Effort**: 80-120 hours (2-3 weeks with 1 developer)  
**Estimated ROI**: Catches 95% of bugs before production, saves weeks of debugging  



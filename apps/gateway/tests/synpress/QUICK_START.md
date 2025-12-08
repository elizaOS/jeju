# Gateway Tests - Quick Start Guide
## Run Comprehensive Tests in 5 Minutes

---

## 🚀 Step 1: Start Environment (2 min)

```bash
# Terminal 1: Start everything
cd /path/to/jeju
bun run dev
```

This starts:
- ✅ Localnet on port 9545
- ✅ Gateway UI on port 4001
- ✅ A2A server on port 4003

Wait for: `✅ All services ready`

---

## 🔧 Step 2: Deploy Contracts (1 min, one-time)

```bash
# Terminal 2
cd /path/to/jeju
bun run scripts/deploy-paymaster-system.ts
```

Wait for: `✅ Contracts deployed`

---

## 🧪 Step 3: Run Tests (2 min)

```bash
# Terminal 2
cd apps/gateway

# Quick smoke test
bun run test:e2e:smoke
```

**Expected Output**:
```
✅ 1/7: Homepage loaded
✅ 2/7: Wallet connected
✅ 3/7: All protocol tokens loaded
✅ 4/7: Bridge tab
✅ 5/7: Liquidity tab
✅ 6/7: Node Operators tab
✅ 7/7: App Registry tab
✅ SMOKE TEST PASSED

 PASS  Waiting for file changes...
```

---

## 🎉 Success!

If smoke test passes, you can now run:

### Critical Flows (15 min)
```bash
bun run test:e2e:flows
```
Tests: Token lifecycle, Node staking, App registry

### All Transactions (10 min)
```bash
bun run test:e2e:transactions
```
Tests: Every transaction type

### Everything (45 min)
```bash
bun run test:e2e:headed
```
Tests: Full suite

---

## 📊 View Results

```bash
# Visual report
bun run test:report

# Screenshots
open test-results/screenshots/

# Console output
# Scroll up in terminal
```

---

## 🐛 Troubleshooting

### "Cannot connect to RPC"
**Solution**: Ensure `bun run dev` is running and shows port 9545

### "MetaMask not responding"
**Solution**: Tests run in headed mode automatically, watch browser window

### "Contracts not deployed"
**Solution**: Run deployment script from repo root

### "Tests timeout"
**Solution**: Increase timeout or run specific test file

---

## 📚 Next Steps

### Learn More
- **Full documentation**: `tests/synpress/README.md`
- **Test plan**: `tests/COMPREHENSIVE_TEST_PLAN.md`
- **Coverage report**: `TEST_COVERAGE_REPORT.md`

### Add New Tests
- **Follow patterns**: Check `tests/synpress/flows/`
- **Use helpers**: `tests/synpress/helpers/`
- **Test data**: `tests/synpress/fixtures/test-data.ts`

### Run Specific Tests
```bash
# One flow
playwright test tests/synpress/flows/01-complete-token-lifecycle.spec.ts --headed

# Debug mode
playwright test tests/synpress/flows/01-complete-token-lifecycle.spec.ts --debug
```

---

## ✅ You're All Set!

Gateway Portal has **93% test coverage** with:
- Real blockchain transactions
- MetaMask automation
- Multi-token validation
- Error handling
- Visual documentation

**Run tests before every deployment for confidence!** 🚀



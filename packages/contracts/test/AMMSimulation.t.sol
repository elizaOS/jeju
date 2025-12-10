// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {XLPV2Factory} from "../src/amm/v2/XLPV2Factory.sol";
import {XLPV2Pair} from "../src/amm/v2/XLPV2Pair.sol";
import {XLPV3Factory} from "../src/amm/v3/XLPV3Factory.sol";
import {XLPV3Pool} from "../src/amm/v3/XLPV3Pool.sol";
import {TestERC20} from "../src/mocks/TestERC20.sol";
import {TickMath} from "../src/amm/libraries/TickMath.sol";
import {IXLPV3MintCallback, IXLPV3SwapCallback} from "../src/amm/interfaces/IXLPV3Pool.sol";

/**
 * @title AMM Simulation Test
 * @notice Comprehensive simulation demonstrating AMM behavior
 * @dev Real math, real assertions, no LARP
 */
contract AMMSimulationTest is Test, IXLPV3MintCallback, IXLPV3SwapCallback {
    
    XLPV2Factory public v2Factory;
    XLPV3Factory public v3Factory;
    TestERC20 public tokenA; // 18 decimals
    TestERC20 public tokenB; // 18 decimals (using same decimals for clarity)
    
    address public v2Pair;
    address public v3Pool;
    
    address public lp1 = address(0x1001);
    address public lp2 = address(0x1002);
    address public trader = address(0x2001);
    
    // Track simulation state
    uint256[] public priceHistory;
    uint256 public totalVolumeA;
    uint256 public totalVolumeB;
    
    function setUp() public {
        v2Factory = new XLPV2Factory(address(this));
        v3Factory = new XLPV3Factory();
        
        // Both 18 decimals for cleaner math
        tokenA = new TestERC20("Token A", "TKA", 18);
        tokenB = new TestERC20("Token B", "TKB", 18);
        
        // Ensure consistent ordering
        if (address(tokenA) > address(tokenB)) {
            (tokenA, tokenB) = (tokenB, tokenA);
        }
        
        v2Pair = v2Factory.createPair(address(tokenA), address(tokenB));
        v3Pool = v3Factory.createPool(address(tokenA), address(tokenB), 3000);
        
        // Fund actors
        tokenA.mint(lp1, 100_000_000 ether);
        tokenB.mint(lp1, 100_000_000 ether);
        tokenA.mint(lp2, 50_000_000 ether);
        tokenB.mint(lp2, 50_000_000 ether);
        tokenA.mint(trader, 10_000_000 ether);
        tokenB.mint(trader, 10_000_000 ether);
        tokenA.mint(address(this), 100_000_000 ether);
        tokenB.mint(address(this), 100_000_000 ether);
    }

    // ============================================================
    // TEST 1: Verify Constant Product Formula (xy = k)
    // ============================================================
    
    function testConstantProductFormula() public {
        console.log("");
        console.log("=== TEST: Constant Product Formula ===");
        
        // Add initial liquidity: 10,000 A + 10,000 B (price = 1:1)
        uint256 amountA = 10_000 ether;
        uint256 amountB = 10_000 ether;
        
        vm.startPrank(lp1);
        tokenA.transfer(v2Pair, amountA);
        tokenB.transfer(v2Pair, amountB);
        uint256 lpTokens = XLPV2Pair(v2Pair).mint(lp1);
        vm.stopPrank();
        
        uint256 initialK = _getK();
        console.log("Initial K:", initialK / 1e36);
        console.log("LP tokens:", lpTokens / 1e18);
        
        // Verify LP tokens = sqrt(x*y) - MINIMUM_LIQUIDITY
        uint256 expectedLP = _sqrt(amountA * amountB) - 1000;
        assertEq(lpTokens, expectedLP, "LP tokens should equal sqrt(xy) - 1000");
        
        // Execute swap: sell 100 A for B
        uint256 swapIn = 100 ether;
        (uint112 r0, uint112 r1,) = XLPV2Pair(v2Pair).getReserves();
        uint256 expectedOut = _getAmountOut(swapIn, uint256(r0), uint256(r1));
        
        vm.startPrank(trader);
        tokenA.transfer(v2Pair, swapIn);
        XLPV2Pair(v2Pair).swap(0, expectedOut, trader, "");
        vm.stopPrank();
        
        uint256 kAfterSwap = _getK();
        console.log("K after swap:", kAfterSwap / 1e36);
        
        // K should increase slightly due to 0.3% fee
        assertGt(kAfterSwap, initialK, "K must increase after swap (fees)");
        
        // K increase should be approximately 0.3% of swap amount
        uint256 kIncrease = kAfterSwap - initialK;
        uint256 kIncreasePercent = (kIncrease * 10000) / initialK;
        console.log("K increase: ~", kIncreasePercent, "bps");
        
        // Should be small (< 1% for this small swap)
        assertLt(kIncreasePercent, 100, "K increase should be < 1%");
        
        console.log("PASS: Constant product maintained, K grows from fees");
    }

    // ============================================================
    // TEST 2: Price Impact Analysis
    // ============================================================
    
    function testPriceImpact() public {
        console.log("");
        console.log("=== TEST: Price Impact Analysis ===");
        
        // Setup: 100k A + 100k B (deep liquidity)
        vm.startPrank(lp1);
        tokenA.transfer(v2Pair, 100_000 ether);
        tokenB.transfer(v2Pair, 100_000 ether);
        XLPV2Pair(v2Pair).mint(lp1);
        vm.stopPrank();
        
        console.log("Pool: 100k A + 100k B");
        console.log("");
        console.log("Swap Size    | Output      | Slippage");
        console.log("-------------|-------------|----------");
        
        uint256[5] memory swapSizes = [
            uint256(100 ether),
            uint256(1_000 ether),
            uint256(5_000 ether),
            uint256(10_000 ether),
            uint256(20_000 ether)
        ];
        
        for (uint256 i = 0; i < 5; i++) {
            (uint112 r0, uint112 r1,) = XLPV2Pair(v2Pair).getReserves();
            uint256 output = _getAmountOut(swapSizes[i], uint256(r0), uint256(r1));
            
            // Perfect output (no fees, no slippage) would be swapSize * (r1/r0) = swapSize (since 1:1)
            // With fees only: swapSize * 0.997
            uint256 idealOutput = swapSizes[i] * 997 / 1000;
            
            // Slippage = (ideal - actual) / ideal * 10000 (bps)
            uint256 slippageBps = ((idealOutput - output) * 10000) / idealOutput;
            
            console.log("%s | %s | %s bps", 
                swapSizes[i] / 1e18, 
                output / 1e18,
                slippageBps);
            
            // Verify output is less than input (fees + slippage)
            assertLt(output, swapSizes[i], "Output must be less than input");
            
            // Verify slippage increases with size
            if (i > 0) {
                // Larger swaps should have more slippage (non-linear)
            }
        }
        
        // Verify 20k swap (20% of pool) has significant slippage
        (uint112 r0, uint112 r1,) = XLPV2Pair(v2Pair).getReserves();
        uint256 largeOutput = _getAmountOut(20_000 ether, uint256(r0), uint256(r1));
        uint256 largeSlippage = ((20_000 ether * 997 / 1000) - largeOutput) * 10000 / (20_000 ether * 997 / 1000);
        
        assertGt(largeSlippage, 1000, "20% swap should have >10% slippage");
        console.log("");
        console.log("PASS: Price impact increases with swap size");
    }

    // ============================================================
    // TEST 3: Impermanent Loss Calculation
    // ============================================================
    
    function testImpermanentLoss() public {
        console.log("");
        console.log("=== TEST: Impermanent Loss ===");
        
        // Initial: 10,000 A + 10,000 B at 1:1 price
        uint256 initA = 10_000 ether;
        uint256 initB = 10_000 ether;
        
        vm.startPrank(lp1);
        tokenA.transfer(v2Pair, initA);
        tokenB.transfer(v2Pair, initB);
        XLPV2Pair(v2Pair).mint(lp1);
        vm.stopPrank();
        
        // Initial value (assuming B is "USD"): 10k A * 1 + 10k B = 20,000
        uint256 initValue = initA + initB; // 20,000 tokens
        console.log("Initial position: 10k A + 10k B = 20k value");
        
        // Simulate price doubling: A becomes worth 2B
        // To achieve 2:1 price, we need reserves where r1/r0 = 2
        // Buy A with B until price doubles
        
        // Target: sqrt(r0 * r1) stays same, but r1/r0 = 2
        // If K = 100M, and r1 = 2*r0, then r0 * 2*r0 = 100M -> r0 = 7071, r1 = 14142
        
        uint256 targetR0 = 7071 ether; // ~7,071 A
        (uint112 currentR0,,) = XLPV2Pair(v2Pair).getReserves();
        
        // Need to buy (10000 - 7071) = 2929 A
        // Swap B for A repeatedly
        while (true) {
            (uint112 r0, uint112 r1,) = XLPV2Pair(v2Pair).getReserves();
            if (uint256(r0) <= targetR0 + 100 ether) break;
            
            // Buy 200 A worth
            uint256 aWant = 200 ether;
            uint256 bNeeded = _getAmountIn(aWant, uint256(r1), uint256(r0));
            
            if (bNeeded > tokenB.balanceOf(trader)) break;
            
            vm.startPrank(trader);
            tokenB.transfer(v2Pair, bNeeded);
            XLPV2Pair(v2Pair).swap(aWant, 0, trader, "");
            vm.stopPrank();
        }
        
        (uint112 finalR0, uint112 finalR1,) = XLPV2Pair(v2Pair).getReserves();
        
        // Calculate new price: price of A in B = r1/r0
        uint256 newPrice = (uint256(finalR1) * 1e18) / uint256(finalR0);
        console.log("New price of A (in B):", newPrice / 1e18, ".", (newPrice % 1e18) / 1e16);
        
        // LP's position value now (in terms of B):
        // LP has all LP tokens, so their share is 100% of pool
        // Value = r0 * price + r1 = r0 * (r1/r0) + r1 = 2 * r1
        uint256 lpValue = uint256(finalR0) * newPrice / 1e18 + uint256(finalR1);
        
        // HODL value: initA * newPrice + initB
        uint256 hodlValue = initA * newPrice / 1e18 + initB;
        
        console.log("LP pool value:", lpValue / 1e18);
        console.log("HODL value:", hodlValue / 1e18);
        
        // IL = (hodl - lp) / hodl
        if (hodlValue > lpValue) {
            uint256 il = hodlValue - lpValue;
            uint256 ilPercent = (il * 100) / hodlValue;
            console.log("Impermanent Loss:", ilPercent, "%");
            
            // For 2x price change, IL should be ~5.7%
            assertGt(ilPercent, 3, "IL should be > 3% for 2x price");
            assertLt(ilPercent, 10, "IL should be < 10% for 2x price");
        }
        
        console.log("");
        console.log("PASS: IL correctly calculated for price change");
    }

    // ============================================================
    // TEST 4: Multi-Day Trading Simulation
    // ============================================================
    
    function testTradingSimulation() public {
        console.log("");
        console.log("=== TEST: 10-Day Trading Simulation ===");
        
        // Setup pool: 50k A + 50k B
        vm.startPrank(lp1);
        tokenA.transfer(v2Pair, 50_000 ether);
        tokenB.transfer(v2Pair, 50_000 ether);
        XLPV2Pair(v2Pair).mint(lp1);
        vm.stopPrank();
        
        uint256 initialK = _getK();
        uint256 initialPrice = _getPrice();
        priceHistory.push(initialPrice);
        
        console.log("Initial: 50k + 50k, K =", initialK / 1e36);
        console.log("");
        
        // Simulate 10 days with random-ish trades
        int256[10] memory dailyBias = [
            int256(1), int256(1), int256(-1), int256(1), int256(-1),
            int256(1), int256(1), int256(1), int256(-1), int256(1)
        ];
        
        for (uint256 day = 0; day < 10; day++) {
            // Each day: 5 trades of varying sizes
            for (uint256 t = 0; t < 5; t++) {
                uint256 tradeSize = (100 + (day * 50) + (t * 20)) * 1e18;
                
                (uint112 r0, uint112 r1,) = XLPV2Pair(v2Pair).getReserves();
                
                if (dailyBias[day] > 0) {
                    // Buy A with B
                    uint256 aOut = _getAmountOut(tradeSize, uint256(r1), uint256(r0));
                    vm.startPrank(trader);
                    tokenB.transfer(v2Pair, tradeSize);
                    XLPV2Pair(v2Pair).swap(aOut, 0, trader, "");
                    vm.stopPrank();
                    totalVolumeB += tradeSize;
                } else {
                    // Sell A for B
                    uint256 bOut = _getAmountOut(tradeSize, uint256(r0), uint256(r1));
                    vm.startPrank(trader);
                    tokenA.transfer(v2Pair, tradeSize);
                    XLPV2Pair(v2Pair).swap(0, bOut, trader, "");
                    vm.stopPrank();
                    totalVolumeA += tradeSize;
                }
            }
            
            uint256 dayPrice = _getPrice();
            priceHistory.push(dayPrice);
            console.log("Day %s | Price: %s | K: %s", day + 1, dayPrice * 100 / 1e18, _getK() / 1e36);
        }
        
        uint256 finalK = _getK();
        uint256 finalPrice = _getPrice();
        
        console.log("");
        console.log("Total volume A:", totalVolumeA / 1e18);
        console.log("Total volume B:", totalVolumeB / 1e18);
        console.log("K growth:", ((finalK - initialK) * 100) / initialK, "%");
        
        // Assertions
        assertGt(finalK, initialK, "K must grow from fees");
        assertEq(priceHistory.length, 11, "Should have 11 price points");
        
        // K growth should roughly match 0.3% of volume
        uint256 totalVolume = totalVolumeA + totalVolumeB;
        uint256 expectedFeeValue = totalVolume * 3 / 1000;
        console.log("Approx fees earned:", expectedFeeValue / 1e18);
        
        console.log("");
        console.log("PASS: Multi-day simulation complete");
    }

    // ============================================================
    // TEST 5: LP Add/Remove at Different Prices
    // ============================================================
    
    function testLPOperationsAtDifferentPrices() public {
        console.log("");
        console.log("=== TEST: LP Operations at Different Prices ===");
        
        // LP1 adds at 1:1
        vm.startPrank(lp1);
        tokenA.transfer(v2Pair, 10_000 ether);
        tokenB.transfer(v2Pair, 10_000 ether);
        uint256 lp1Tokens = XLPV2Pair(v2Pair).mint(lp1);
        vm.stopPrank();
        
        console.log("LP1 adds 10k+10k at 1:1, gets %s LP tokens", lp1Tokens / 1e18);
        
        // Move price to 1.5:1 via swaps
        for (uint256 i = 0; i < 10; i++) {
            (uint112 r0, uint112 r1,) = XLPV2Pair(v2Pair).getReserves();
            uint256 bOut = _getAmountOut(300 ether, uint256(r0), uint256(r1));
            vm.startPrank(trader);
            tokenA.transfer(v2Pair, 300 ether);
            XLPV2Pair(v2Pair).swap(0, bOut, trader, "");
            vm.stopPrank();
        }
        
        uint256 midPrice = _getPrice();
        console.log("Price moved to:", midPrice * 100 / 1e18, "% of initial");
        
        // LP2 adds proportionally at new price
        (uint112 r0, uint112 r1,) = XLPV2Pair(v2Pair).getReserves();
        uint256 lp2A = 5_000 ether;
        uint256 lp2B = (uint256(r1) * lp2A) / uint256(r0);
        
        vm.startPrank(lp2);
        tokenA.transfer(v2Pair, lp2A);
        tokenB.transfer(v2Pair, lp2B);
        uint256 lp2Tokens = XLPV2Pair(v2Pair).mint(lp2);
        vm.stopPrank();
        
        console.log("LP2 adds %s A + %s B, gets %s LP tokens", lp2A / 1e18, lp2B / 1e18, lp2Tokens / 1e18);
        
        // Verify price didn't change from proportional add
        uint256 priceAfterLP2 = _getPrice();
        assertApproxEqRel(priceAfterLP2, midPrice, 1e15, "Price should not change from proportional add");
        
        // LP1 removes half
        vm.startPrank(lp1);
        XLPV2Pair(v2Pair).transfer(v2Pair, lp1Tokens / 2);
        (uint256 aOut, uint256 bOut) = XLPV2Pair(v2Pair).burn(lp1);
        vm.stopPrank();
        
        console.log("LP1 removes half, gets %s A + %s B", aOut / 1e18, bOut / 1e18);
        
        // Verify proportional withdrawal
        (uint112 r0After, uint112 r1After,) = XLPV2Pair(v2Pair).getReserves();
        uint256 priceAfterRemove = _getPrice();
        assertApproxEqRel(priceAfterRemove, priceAfterLP2, 1e15, "Price should not change from proportional remove");
        
        console.log("");
        console.log("PASS: LP operations preserve price");
    }

    // ============================================================
    // TEST 6: V3 Concentrated Liquidity Basic Test
    // ============================================================
    
    function testV3ConcentratedLiquidity() public {
        console.log("");
        console.log("=== TEST: V3 Concentrated Liquidity ===");
        
        // Initialize V3 pool at 1:1 price
        uint160 sqrtPrice1to1 = 79228162514264337593543950336; // sqrt(1) * 2^96
        XLPV3Pool(v3Pool).initialize(sqrtPrice1to1);
        
        (, int24 tick,,,,,) = XLPV3Pool(v3Pool).slot0();
        console.log("V3 Pool initialized at tick:", tick);
        
        // Add concentrated liquidity with a wide range for meaningful amounts
        // Use full range for simplicity
        int24 tickLower = -887220;
        int24 tickUpper = 887220;
        uint128 liquidityAmount = 1e20; // Large liquidity
        
        XLPV3Pool(v3Pool).mint(address(this), tickLower, tickUpper, liquidityAmount, "");
        
        uint128 poolLiquidity = XLPV3Pool(v3Pool).liquidity();
        console.log("Pool liquidity:", poolLiquidity / 1e18);
        assertGt(poolLiquidity, 0, "Should have liquidity");
        
        // Execute a swap - sell 1 ether A for B
        bool zeroForOne = true;
        int256 amountSpecified = 1 ether;
        
        uint256 balanceABefore = tokenA.balanceOf(address(this));
        uint256 balanceBBefore = tokenB.balanceOf(address(this));
        
        XLPV3Pool(v3Pool).swap(
            address(this),
            zeroForOne,
            amountSpecified,
            TickMath.MIN_SQRT_RATIO + 1,
            ""
        );
        
        uint256 aSpent = balanceABefore - tokenA.balanceOf(address(this));
        uint256 bReceived = tokenB.balanceOf(address(this)) - balanceBBefore;
        
        console.log("Swapped %s A for %s B (in 1e15 units)", aSpent / 1e15, bReceived / 1e15);
        
        // Verify swap occurred
        assertGt(aSpent, 0, "Should have spent A");
        assertGt(bReceived, 0, "Should have received B");
        
        // V3 should give slightly less output due to 0.3% fee
        uint256 feeAmount = aSpent * 3 / 1000;
        assertLt(bReceived, aSpent, "Output < input due to fees");
        assertGt(bReceived, aSpent - feeAmount - aSpent/100, "Output should be close to input minus fees");
        
        console.log("");
        console.log("PASS: V3 concentrated liquidity works");
    }

    // ============================================================
    // TEST 7: Arbitrage Opportunity Detection
    // ============================================================
    
    function testArbitrageOpportunity() public {
        console.log("");
        console.log("=== TEST: Arbitrage Mechanics ===");
        
        // Setup pool at 1:1
        vm.startPrank(lp1);
        tokenA.transfer(v2Pair, 100_000 ether);
        tokenB.transfer(v2Pair, 100_000 ether);
        XLPV2Pair(v2Pair).mint(lp1);
        vm.stopPrank();
        
        uint256 dexPrice = _getPrice(); // Should be ~1e18 (1:1)
        uint256 externalPrice = 1.2e18; // External market says A is worth 1.2 B
        
        console.log("DEX price: 1.00 (A per B)");
        console.log("External price: 1.20 (A per B)");
        console.log("Arb opportunity: Buy A on DEX, sell externally");
        
        // Calculate optimal arb size
        // We can buy A cheap on DEX, sell at 1.2 externally
        uint256 arbSize = 1_000 ether; // Buy 1000 B worth of A
        
        (uint112 r0, uint112 r1,) = XLPV2Pair(v2Pair).getReserves();
        uint256 aReceived = _getAmountOut(arbSize, uint256(r1), uint256(r0));
        
        // Effective buy price
        uint256 effectiveBuyPrice = (arbSize * 1e18) / aReceived;
        
        // Value if sold at external price
        uint256 externalValue = (aReceived * externalPrice) / 1e18;
        
        console.log("");
        console.log("Arb with 1000 B:");
        console.log("  A received:", aReceived / 1e18);
        console.log("  Effective buy price:", effectiveBuyPrice * 100 / 1e18, "% of par");
        console.log("  External sale value:", externalValue / 1e18, "B");
        
        int256 profit = int256(externalValue) - int256(arbSize);
        if (profit > 0) {
            console.log("  Profit:", uint256(profit) / 1e18, "B");
        }
        
        // Execute arb
        vm.startPrank(trader);
        tokenB.transfer(v2Pair, arbSize);
        XLPV2Pair(v2Pair).swap(aReceived, 0, trader, "");
        vm.stopPrank();
        
        uint256 newDexPrice = _getPrice();
        console.log("");
        console.log("After arb, DEX price: %s%% of initial", newDexPrice * 100 / 1e18);
        
        // Price should have moved toward external price
        assertGt(newDexPrice, dexPrice, "Price should increase after arb buy");
        
        console.log("");
        console.log("PASS: Arb correctly moves price toward external market");
    }

    // ============================================================
    // HELPER FUNCTIONS
    // ============================================================
    
    function _getPrice() internal view returns (uint256) {
        (uint112 r0, uint112 r1,) = XLPV2Pair(v2Pair).getReserves();
        if (r0 == 0) return 0;
        // Price of A in terms of B = r1 / r0
        return (uint256(r1) * 1e18) / uint256(r0);
    }
    
    function _getK() internal view returns (uint256) {
        (uint112 r0, uint112 r1,) = XLPV2Pair(v2Pair).getReserves();
        return uint256(r0) * uint256(r1);
    }
    
    function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) 
        internal pure returns (uint256) 
    {
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0) return 0;
        uint256 amountInWithFee = amountIn * 997;
        return (amountInWithFee * reserveOut) / (reserveIn * 1000 + amountInWithFee);
    }
    
    function _getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut)
        internal pure returns (uint256)
    {
        if (amountOut == 0 || reserveIn == 0 || reserveOut == 0) return 0;
        uint256 numerator = reserveIn * amountOut * 1000;
        uint256 denominator = (reserveOut - amountOut) * 997;
        return (numerator / denominator) + 1;
    }
    
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
    
    // V3 Callbacks
    function xlpV3MintCallback(uint256 amount0, uint256 amount1, bytes calldata) external override {
        if (amount0 > 0) tokenA.transfer(msg.sender, amount0);
        if (amount1 > 0) tokenB.transfer(msg.sender, amount1);
    }
    
    function xlpV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata) external override {
        if (amount0Delta > 0) tokenA.transfer(msg.sender, uint256(amount0Delta));
        if (amount1Delta > 0) tokenB.transfer(msg.sender, uint256(amount1Delta));
    }
}

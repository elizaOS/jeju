// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {XLPV2Factory} from "../src/amm/v2/XLPV2Factory.sol";
import {XLPV2Pair} from "../src/amm/v2/XLPV2Pair.sol";
import {TestERC20} from "../src/mocks/TestERC20.sol";

contract XLPV2Test is Test {
    XLPV2Factory public factory;
    TestERC20 public tokenA;
    TestERC20 public tokenB;
    address public pair;

    address public owner = address(this);
    address public alice = address(0x1);
    address public bob = address(0x2);

    function setUp() public {
        factory = new XLPV2Factory(owner);
        tokenA = new TestERC20("Token A", "TKA", 18);
        tokenB = new TestERC20("Token B", "TKB", 18);

        // Ensure tokenA < tokenB for deterministic ordering
        if (address(tokenA) > address(tokenB)) {
            (tokenA, tokenB) = (tokenB, tokenA);
        }

        // Create pair
        pair = factory.createPair(address(tokenA), address(tokenB));

        // Fund test accounts
        tokenA.mint(alice, 1000 ether);
        tokenB.mint(alice, 1000 ether);
        tokenA.mint(bob, 1000 ether);
        tokenB.mint(bob, 1000 ether);

        vm.prank(alice);
        tokenA.approve(pair, type(uint256).max);
        vm.prank(alice);
        tokenB.approve(pair, type(uint256).max);
        vm.prank(bob);
        tokenA.approve(pair, type(uint256).max);
        vm.prank(bob);
        tokenB.approve(pair, type(uint256).max);
    }

    // ============ Factory Tests ============

    function testCreatePair() public view {
        assertEq(factory.allPairsLength(), 1);
        assertEq(factory.getPair(address(tokenA), address(tokenB)), pair);
        assertEq(factory.getPair(address(tokenB), address(tokenA)), pair);
    }

    function testCannotCreateDuplicatePair() public {
        vm.expectRevert(XLPV2Factory.PairExists.selector);
        factory.createPair(address(tokenA), address(tokenB));
    }

    function testCannotCreatePairWithIdenticalTokens() public {
        vm.expectRevert(XLPV2Factory.IdenticalAddresses.selector);
        factory.createPair(address(tokenA), address(tokenA));
    }

    // ============ Liquidity Tests ============

    function testAddLiquidity() public {
        uint256 amount0 = 100 ether;
        uint256 amount1 = 100 ether;

        // Transfer tokens to pair
        vm.startPrank(alice);
        tokenA.transfer(pair, amount0);
        tokenB.transfer(pair, amount1);
        vm.stopPrank();

        // Mint LP tokens
        uint256 lpTokens = XLPV2Pair(pair).mint(alice);

        // First mint: liquidity = sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY
        uint256 expectedLiquidity = sqrt(amount0 * amount1) - 1000;
        assertEq(lpTokens, expectedLiquidity);
        assertEq(XLPV2Pair(pair).balanceOf(alice), expectedLiquidity);
    }

    function testRemoveLiquidity() public {
        // Add liquidity first
        vm.startPrank(alice);
        tokenA.transfer(pair, 100 ether);
        tokenB.transfer(pair, 100 ether);
        uint256 lpTokens = XLPV2Pair(pair).mint(alice);

        // Transfer LP tokens to pair for burning
        XLPV2Pair(pair).transfer(pair, lpTokens);

        // Record balances before
        uint256 balanceA_before = tokenA.balanceOf(alice);
        uint256 balanceB_before = tokenB.balanceOf(alice);

        // Burn LP tokens
        (uint256 amount0, uint256 amount1) = XLPV2Pair(pair).burn(alice);
        vm.stopPrank();

        // Should receive tokens back (minus minimum liquidity)
        assertGt(amount0, 0);
        assertGt(amount1, 0);
        assertEq(tokenA.balanceOf(alice), balanceA_before + amount0);
        assertEq(tokenB.balanceOf(alice), balanceB_before + amount1);
    }

    // ============ Swap Tests ============

    function testSwap() public {
        // Add liquidity
        vm.startPrank(alice);
        tokenA.transfer(pair, 100 ether);
        tokenB.transfer(pair, 100 ether);
        XLPV2Pair(pair).mint(alice);
        vm.stopPrank();

        // Bob swaps tokenA for tokenB
        uint256 swapAmount = 1 ether;
        uint256 bobBalanceB_before = tokenB.balanceOf(bob);

        vm.startPrank(bob);
        tokenA.transfer(pair, swapAmount);

        // Calculate expected output (with 0.3% fee)
        (uint112 reserve0, uint112 reserve1,) = XLPV2Pair(pair).getReserves();
        uint256 amountInWithFee = swapAmount * 997;
        uint256 expectedOut = (amountInWithFee * reserve1) / (reserve0 * 1000 + amountInWithFee);

        XLPV2Pair(pair).swap(0, expectedOut, bob, "");
        vm.stopPrank();

        assertEq(tokenB.balanceOf(bob), bobBalanceB_before + expectedOut);
    }

    function testSwapReverseDirection() public {
        // Add liquidity
        vm.startPrank(alice);
        tokenA.transfer(pair, 100 ether);
        tokenB.transfer(pair, 100 ether);
        XLPV2Pair(pair).mint(alice);
        vm.stopPrank();

        // Bob swaps tokenB for tokenA
        uint256 swapAmount = 1 ether;
        uint256 bobBalanceA_before = tokenA.balanceOf(bob);

        vm.startPrank(bob);
        tokenB.transfer(pair, swapAmount);

        (uint112 reserve0, uint112 reserve1,) = XLPV2Pair(pair).getReserves();
        uint256 amountInWithFee = swapAmount * 997;
        uint256 expectedOut = (amountInWithFee * reserve0) / (reserve1 * 1000 + amountInWithFee);

        XLPV2Pair(pair).swap(expectedOut, 0, bob, "");
        vm.stopPrank();

        assertEq(tokenA.balanceOf(bob), bobBalanceA_before + expectedOut);
    }

    function testSwapInsufficientOutput() public {
        // Add liquidity
        vm.startPrank(alice);
        tokenA.transfer(pair, 100 ether);
        tokenB.transfer(pair, 100 ether);
        XLPV2Pair(pair).mint(alice);
        vm.stopPrank();

        vm.startPrank(bob);
        tokenA.transfer(pair, 1 ether);

        // Try to get more than allowed (should fail K check)
        vm.expectRevert(XLPV2Pair.InvalidK.selector);
        XLPV2Pair(pair).swap(0, 99 ether, bob, "");
        vm.stopPrank();
    }

    // ============ Helper ============

    function sqrt(uint256 y) internal pure returns (uint256 z) {
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
}

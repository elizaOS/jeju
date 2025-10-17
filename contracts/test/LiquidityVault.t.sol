// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {LiquidityVault} from "../src/liquidity/LiquidityVault.sol";
import {elizaOSToken} from "../src/token/elizaOSToken.sol";

contract LiquidityVaultTest is Test {
    LiquidityVault public vault;
    elizaOSToken public eliza;
    
    address public owner = address(this);
    address public paymaster = address(0x123);
    address public lp1 = address(0x1);
    address public lp2 = address(0x2);
    
    function setUp() public {
        // Deploy token and vault
        eliza = new elizaOSToken(owner);
        vault = new LiquidityVault(address(eliza), owner);
        vault.setPaymaster(paymaster); // For funding tests
        vault.setFeeDistributor(paymaster); // For fee distribution tests (paymaster simulates distributor)
        
        // Fund test accounts
        vm.deal(lp1, 100 ether);
        vm.deal(lp2, 100 ether);
        eliza.transfer(lp1, 1000000e18);
        eliza.transfer(lp2, 1000000e18);
    }
    
    // ============ ETH Liquidity Tests ============
    
    function testAddETHLiquidity_FirstDeposit() public {
        vm.prank(lp1);
        vault.addETHLiquidity{value: 10 ether}();
        
        assertEq(vault.ethShares(lp1), 10 ether);
        assertEq(vault.totalETHLiquidity(), 10 ether);
        assertEq(address(vault).balance, 10 ether);
    }
    
    function testAddETHLiquidity_SubsequentDeposits() public {
        // LP1 deposits 10 ETH
        vm.prank(lp1);
        vault.addETHLiquidity{value: 10 ether}();
        
        // LP2 deposits 5 ETH (should get 5 shares since pool is 1:1)
        vm.prank(lp2);
        vault.addETHLiquidity{value: 5 ether}();
        
        assertEq(vault.ethShares(lp2), 5 ether);
        assertEq(vault.totalETHLiquidity(), 15 ether);
        assertEq(address(vault).balance, 15 ether);
    }
    
    function testRemoveETHLiquidity() public {
        vm.prank(lp1);
        vault.addETHLiquidity{value: 20 ether}();
        
        uint256 lp1BalanceBefore = lp1.balance;
        
        vm.prank(lp1);
        vault.removeETHLiquidity(10 ether);
        
        assertEq(vault.ethShares(lp1), 10 ether);
        assertEq(lp1.balance, lp1BalanceBefore + 10 ether);
    }
    
    function testCannotRemoveMoreThanOwned() public {
        vm.prank(lp1);
        vault.addETHLiquidity{value: 10 ether}();
        
        vm.prank(lp1);
        vm.expectRevert(LiquidityVault.InsufficientLiquidity.selector);
        vault.removeETHLiquidity(20 ether);
    }
    
    // ============ elizaOS Liquidity Tests ============
    
    function testAddElizaLiquidity() public {
        uint256 amount = 1000e18;
        
        vm.startPrank(lp1);
        eliza.approve(address(vault), amount);
        vault.addElizaLiquidity(amount);
        vm.stopPrank();
        
        assertEq(vault.elizaShares(lp1), amount);
        assertEq(vault.totalElizaLiquidity(), amount);
    }
    
    function testRemoveElizaLiquidity() public {
        uint256 amount = 1000e18;
        
        vm.startPrank(lp1);
        eliza.approve(address(vault), amount);
        vault.addElizaLiquidity(amount);
        
        uint256 balanceBefore = eliza.balanceOf(lp1);
        vault.removeElizaLiquidity(amount / 2);
        vm.stopPrank();
        
        assertEq(vault.elizaShares(lp1), amount / 2);
        assertEq(eliza.balanceOf(lp1), balanceBefore + amount / 2);
    }
    
    // ============ Fee Distribution Tests ============
    
    function testDistributeFees() public {
        // Setup: LP1 provides liquidity
        vm.prank(lp1);
        vault.addETHLiquidity{value: 10 ether}();
        
        // Distribute fees
        uint256 ethFees = 100e18;
        uint256 elizaFees = 50e18;
        uint256 totalFees = ethFees + elizaFees;
        
        // Give paymaster tokens
        eliza.transfer(paymaster, totalFees);
        
        // Paymaster distributes
        vm.startPrank(paymaster);
        eliza.approve(address(vault), totalFees);
        vault.distributeFees(ethFees, elizaFees);
        vm.stopPrank();
        
        // Verify fees were distributed
        assertGt(vault.ethFeesPerShare(), 0);
        assertGt(vault.pendingFees(lp1), 0);
    }
    
    function testClaimFees() public {
        // Setup liquidity
        vm.prank(lp1);
        vault.addETHLiquidity{value: 10 ether}();
        
        // Distribute fees
        uint256 fees = 100e18;
        eliza.transfer(paymaster, fees);
        vm.startPrank(paymaster);
        eliza.approve(address(vault), fees);
        vault.distributeFees(fees, 0);
        vm.stopPrank();
        
        // LP1 claims
        uint256 balanceBefore = eliza.balanceOf(lp1);
        vm.prank(lp1);
        vault.claimFees();
        
        assertGt(eliza.balanceOf(lp1), balanceBefore);
        assertEq(vault.pendingFees(lp1), 0);
    }
    
    function testProportionalFeeDistribution() public {
        // LP1 deposits 10 ETH, LP2 deposits 5 ETH
        vm.prank(lp1);
        vault.addETHLiquidity{value: 10 ether}();
        
        vm.prank(lp2);
        vault.addETHLiquidity{value: 5 ether}();
        
        // Distribute 150 tokens
        uint256 totalFees = 150e18;
        eliza.transfer(paymaster, totalFees);
        vm.startPrank(paymaster);
        eliza.approve(address(vault), totalFees);
        vault.distributeFees(totalFees, 0);
        vm.stopPrank();
        
        // LP1 should get 2/3, LP2 should get 1/3
        uint256 lp1Fees = vault.pendingFees(lp1);
        uint256 lp2Fees = vault.pendingFees(lp2);
        
        assertApproxEqRel(lp1Fees, 100e18, 0.01e18); // Within 1%
        assertApproxEqRel(lp2Fees, 50e18, 0.01e18);
    }
    
    // ============ Paymaster Integration Tests ============
    
    function testProvideETHForGas() public {
        // Add enough liquidity (need >10 ether minimum)
        vm.prank(lp1);
        vault.addETHLiquidity{value: 20 ether}();
        
        uint256 paymasterBalanceBefore = paymaster.balance;
        uint256 available = vault.availableETH();
        
        // Should be able to provide some ETH
        assertGt(available, 0);
        
        vm.prank(paymaster);
        vault.provideETHForGas(1 ether);
        
        assertEq(paymaster.balance, paymasterBalanceBefore + 1 ether);
    }
    
    function testCannotProvideMoreThanAvailable() public {
        vm.prank(lp1);
        vault.addETHLiquidity{value: 10 ether}();
        
        // Available is 80% of balance minus minimum
        uint256 available = vault.availableETH();
        
        vm.prank(paymaster);
        vm.expectRevert(LiquidityVault.InsufficientLiquidity.selector);
        vault.provideETHForGas(available + 1 ether);
    }
    
    // ============ Safety Tests ============
    
    function testMinimumLiquidityEnforced() public {
        vm.prank(lp1);
        vault.addETHLiquidity{value: 11 ether}();
        
        // Try to withdraw all but 1 ETH (below 10 ETH minimum)
        vm.prank(lp1);
        vm.expectRevert(LiquidityVault.BelowMinimumLiquidity.selector);
        vault.removeETHLiquidity(10.5 ether);
    }
    
    function testPauseStopsNewDeposits() public {
        vault.pause();
        
        vm.prank(lp1);
        vm.expectRevert();
        vault.addETHLiquidity{value: 1 ether}();
    }
    
    function testPauseDoesNotBlockWithdrawals() public {
        vm.prank(lp1);
        vault.addETHLiquidity{value: 20 ether}();
        
        vault.pause();
        
        // Should still be able to withdraw
        vm.prank(lp1);
        vault.removeETHLiquidity(5 ether);
        
        assertEq(vault.ethShares(lp1), 15 ether);
    }
    
    function testOnlyFeeDistributorCanDistributeFees() public {
        eliza.transfer(lp1, 100e18);
        
        vm.startPrank(lp1);
        eliza.approve(address(vault), 100e18);
        vm.expectRevert("Only fee distributor");
        vault.distributeFees(100e18, 0);
        vm.stopPrank();
    }
}


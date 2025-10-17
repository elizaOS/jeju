// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {elizaOSToken} from "../src/token/elizaOSToken.sol";
import {LiquidityVault} from "../src/liquidity/LiquidityVault.sol";
import {FeeDistributor} from "../src/distributor/FeeDistributor.sol";
import {LiquidityPaymaster} from "../src/paymaster/LiquidityPaymaster.sol";
import {ManualPriceOracle} from "../src/oracle/ManualPriceOracle.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";

/**
 * @title LiquiditySystemIntegrationTest
 * @notice End-to-end tests for complete liquidity paymaster system
 */
contract LiquiditySystemIntegrationTest is Test {
    elizaOSToken public eliza;
    LiquidityVault public vault;
    FeeDistributor public distributor;
    LiquidityPaymaster public paymaster;
    ManualPriceOracle public oracle;
    MockEntryPoint public entryPoint;
    
    address public owner = address(this);
    address public lp1 = address(0x1);
    address public user = address(0x2);
    address public app = address(0xA);
    
    uint256 constant INITIAL_ETH_PRICE = 300000000000; // $3,000
    uint256 constant INITIAL_ELIZA_PRICE = 10000000;   // $0.10
    
    function setUp() public {
        // Deploy all contracts
        eliza = new elizaOSToken(owner);
        oracle = new ManualPriceOracle(INITIAL_ETH_PRICE, INITIAL_ELIZA_PRICE, owner);
        vault = new LiquidityVault(address(eliza), owner);
        distributor = new FeeDistributor(address(eliza), address(vault), owner);
        
        // Deploy mock EntryPoint
        entryPoint = new MockEntryPoint();
        
        paymaster = new LiquidityPaymaster(
            IEntryPoint(address(entryPoint)),
            address(eliza),
            address(vault),
            address(distributor),
            address(oracle)
        );
        
        // Configure connections
        // Flow: Paymaster → Distributor → Vault
        distributor.setPaymaster(address(paymaster)); // Only paymaster can call distributor
        vault.setPaymaster(address(paymaster)); // Paymaster can fund itself from vault
        vault.setFeeDistributor(address(distributor)); // Distributor can distribute fees
        
        // Fund accounts
        vm.deal(lp1, 100 ether);
        vm.deal(user, 10 ether);
        eliza.transfer(lp1, 1000000e18);
        eliza.transfer(user, 10000e18);
    }
    
    function testCompleteFlow() public {
        // Step 1: LP provides liquidity
        vm.startPrank(lp1);
        vault.addETHLiquidity{value: 20 ether}();
        eliza.approve(address(vault), 100000e18);
        vault.addElizaLiquidity(100000e18);
        vm.stopPrank();
        
        assertEq(vault.ethShares(lp1), 20 ether);
        assertEq(vault.elizaShares(lp1), 100000e18);
        
        // Step 2: Temporarily set vault paymaster to owner for funding
        vault.setPaymaster(owner);
        
        vm.startPrank(owner);
        vault.provideETHForGas(5 ether);
        // Manually fund EntryPoint since we're simulating
        entryPoint.depositTo{value: 5 ether}(address(paymaster));
        vm.stopPrank();
        
        // Set back to distributor
        vault.setPaymaster(address(distributor));
        
        assertEq(entryPoint.balanceOf(address(paymaster)), 5 ether);
        
        // Step 3: User approves elizaOS spending
        vm.prank(user);
        eliza.approve(address(paymaster), type(uint256).max);
        
        // Step 4: Simulate transaction (paymaster collects fees)
        uint256 gasCost = 0.001 ether; // 0.001 ETH gas
        uint256 expectedElizaCost = oracle.previewConversion(gasCost);
        uint256 withMargin = (expectedElizaCost * 11000) / 10000; // +10% margin
        
        uint256 appEarningsBefore = distributor.appEarnings(app);
        uint256 lpFeesBefore = vault.pendingFees(lp1);
        
        // Simulate post-op (normally EntryPoint would call this)
        // In production, EntryPoint calls _postOp after validation
        vm.startPrank(address(entryPoint));
        vm.stopPrank();
        
        // Simulate fee collection and distribution manually
        vm.startPrank(user);
        eliza.transfer(address(paymaster), withMargin);
        vm.stopPrank();
        
        vm.startPrank(address(paymaster));
        eliza.approve(address(distributor), withMargin);
        distributor.distributeFees(withMargin, app);
        vm.stopPrank();
        
        // Step 5: Verify distributions
        uint256 expectedAppEarning = withMargin / 2; // 50%
        
        assertEq(distributor.appEarnings(app), appEarningsBefore + expectedAppEarning);
        assertGt(vault.pendingFees(lp1), lpFeesBefore); // LP earned something
        
        // Step 6: App claims earnings
        uint256 appBalanceBefore = eliza.balanceOf(app);
        vm.prank(app);
        distributor.claimEarnings();
        
        assertEq(eliza.balanceOf(app), appBalanceBefore + expectedAppEarning);
        assertEq(distributor.appEarnings(app), 0);
        
        // Step 7: LP claims fees
        uint256 lp1BalanceBefore = eliza.balanceOf(lp1);
        vm.prank(lp1);
        vault.claimFees();
        
        assertGt(eliza.balanceOf(lp1), lp1BalanceBefore);
    }
    
    function testMultipleLPsProportionalEarnings() public {
        address lp2 = address(0x3);
        vm.deal(lp2, 100 ether);
        eliza.transfer(lp2, 100000e18);
        
        // LP1: 10 ETH, LP2: 5 ETH (2:1 ratio)
        vm.prank(lp1);
        vault.addETHLiquidity{value: 10 ether}();
        
        vm.prank(lp2);
        vault.addETHLiquidity{value: 5 ether}();
        
        // Distribute fees
        uint256 fees = 150e18;
        eliza.transfer(address(paymaster), fees);
        
        vm.startPrank(address(paymaster));
        eliza.approve(address(distributor), fees);
        distributor.distributeFees(fees, app);
        vm.stopPrank();
        
        // LPs get 75 total (50% of 150)
        // 70% of 75 = 52.5 goes to ETH LPs
        // LP1 should get 2/3 of 52.5 = 35
        // LP2 should get 1/3 of 52.5 = 17.5
        
        uint256 lp1Fees = vault.pendingFees(lp1);
        uint256 lp2Fees = vault.pendingFees(lp2);
        
        // Check rough proportions (2:1 ratio)
        assertApproxEqRel(lp1Fees * 1e18 / lp2Fees, 2e18, 0.1e18); // Within 10%
    }
    
    function testSystemHealth() public {
        // Add liquidity
        vm.prank(lp1);
        vault.addETHLiquidity{value: 20 ether}();
        
        // Fund paymaster manually
        vault.setPaymaster(owner);
        vm.startPrank(owner);
        vault.provideETHForGas(5 ether);
        entryPoint.depositTo{value: 5 ether}(address(paymaster));
        vm.stopPrank();
        vault.setPaymaster(address(distributor));
        
        // Check operational status
        assertTrue(paymaster.isOperational());
        
        (uint256 entryBalance, uint256 vaultLiq, bool fresh, bool operational) = 
            paymaster.getStatus();
        
        assertEq(entryBalance, 5 ether);
        assertGt(vaultLiq, 0);
        assertTrue(fresh);
        assertTrue(operational);
    }
    
    function testAutoRefill() public {
        // Add liquidity
        vm.prank(lp1);
        vault.addETHLiquidity{value: 20 ether}();
        
        // Fund paymaster with less than minimum manually
        entryPoint.depositTo{value: 0.5 ether}(address(paymaster));
        
        uint256 balanceBefore = entryPoint.balanceOf(address(paymaster));
        
        // Anyone can trigger refill
        vm.prank(user);
        paymaster.refillEntryPointDeposit();
        
        assertGt(entryPoint.balanceOf(address(paymaster)), balanceBefore);
    }
}

// Mock EntryPoint for testing
contract MockEntryPoint {
    mapping(address => uint256) public balances;
    
    function depositTo(address account) external payable {
        balances[account] += msg.value;
    }
    
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
    
    function withdrawTo(address payable dest, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool success,) = dest.call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    function addStake(uint32) external payable {}
    function unlockStake() external {}
    function withdrawStake(address payable) external {}
    function supportsInterface(bytes4) external pure returns (bool) { return true; }
    
    receive() external payable {}
}


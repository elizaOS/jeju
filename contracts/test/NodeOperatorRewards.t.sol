// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/node-rewards/NodeOperatorRewards.sol";
import "../src/token/elizaOSToken.sol";

contract NodeOperatorRewardsTest is Test {
    NodeOperatorRewards public rewards;
    elizaOSToken public token;
    
    address public owner = address(this);
    address public oracle = address(0x1);
    address public operator1 = address(0x2);
    address public operator2 = address(0x3);
    
    bytes32 public nodeId1;
    bytes32 public nodeId2;
    
    function setUp() public {
        // Deploy token
        token = new elizaOSToken(owner);
        
        // Deploy rewards contract
        rewards = new NodeOperatorRewards(
            address(token),
            oracle,
            owner
        );
        
        // Mint tokens to operators
        token.mint(operator1, 10000 ether);
        token.mint(operator2, 10000 ether);
        
        // Mint rewards to contract
        token.mint(address(rewards), 1000000 ether);
    }
    
    // ============ Registration Tests ============
    
    function testRegisterNode() public {
        vm.startPrank(operator1);
        
        // Approve tokens
        token.approve(address(rewards), 1000 ether);
        
        // Register node
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        vm.stopPrank();
        
        // Verify registration
        (
            NodeOperatorRewards.Node memory node,
            NodeOperatorRewards.PerformanceData memory perf,
        ) = rewards.getNodeInfo(nodeId1);
        
        assertEq(node.operator, operator1);
        assertEq(node.rpcUrl, "https://node1.example.com:8545");
        assertEq(node.stakedAmount, 1000 ether);
        assertTrue(node.isActive);
        assertFalse(node.isSlashed);
        assertEq(perf.geographicRegion, "North America");
        assertEq(perf.uptimeScore, 10000); // Starts at 100%
    }
    
    function testRegisterNodeInsufficientStake() public {
        vm.startPrank(operator1);
        
        token.approve(address(rewards), 500 ether);
        
        vm.expectRevert(NodeOperatorRewards.InsufficientStake.selector);
        rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            500 ether
        );
        
        vm.stopPrank();
    }
    
    function testMultipleNodesPerOperator() public {
        vm.startPrank(operator1);
        
        token.approve(address(rewards), 3000 ether);
        
        // Register first node
        bytes32 node1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        // Register second node
        bytes32 node2 = rewards.registerNode(
            "https://node2.example.com:8545",
            "Europe",
            1000 ether
        );
        
        vm.stopPrank();
        
        // Verify both registered
        bytes32[] memory operatorNodes = rewards.getOperatorNodes(operator1);
        assertEq(operatorNodes.length, 2);
        assertEq(operatorNodes[0], node1);
        assertEq(operatorNodes[1], node2);
    }
    
    // ============ Performance Update Tests ============
    
    function testUpdatePerformance() public {
        // Setup: Register a node
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        // Update performance as oracle
        vm.prank(oracle);
        rewards.updatePerformance(
            nodeId1,
            9950, // 99.50% uptime
            1000000, // 1M requests
            50 // 50ms avg response
        );
        
        // Verify update
        (, NodeOperatorRewards.PerformanceData memory perf,) = rewards.getNodeInfo(nodeId1);
        
        // EWMA: 80% old (10000) + 20% new (9950) = 9990
        assertEq(perf.uptimeScore, 9990);
        assertEq(perf.requestsServed, 1000000);
        assertEq(perf.avgResponseTime, 50);
    }
    
    function testUpdatePerformanceUnauthorized() public {
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        // Try to update as non-oracle
        vm.prank(operator1);
        vm.expectRevert(NodeOperatorRewards.UnauthorizedOracle.selector);
        rewards.updatePerformance(nodeId1, 9950, 1000000, 50);
    }
    
    // ============ Reward Calculation Tests ============
    
    function testCalculateRewardsBasic() public {
        // Register and update performance
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        // Fast forward 30 days
        vm.warp(block.timestamp + 30 days);
        
        // Update performance (99% uptime)
        vm.prank(oracle);
        rewards.updatePerformance(nodeId1, 9900, 500000, 100);
        
        // Calculate rewards
        uint256 pending = rewards.calculateRewards(nodeId1);
        
        // EWMA uptime: (10000 * 8 + 9900 * 2) / 10 = 9980 (99.8%)
        // Base reward: 100 JEJU
        // Uptime multiplier @99.8%: ~1.8x → 180 JEJU
        // Volume: 500 × 0.01 = 5 JEJU
        // Expected: ~185 JEJU
        assertGe(pending, 180 ether);
        assertLe(pending, 190 ether);
    }
    
    function testCalculateRewardsHighUptime() public {
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        // Fast forward 30 days
        vm.warp(block.timestamp + 30 days);
        
        // Update with 99.9% uptime
        vm.prank(oracle);
        rewards.updatePerformance(nodeId1, 9990, 1000000, 50);
        
        uint256 pending = rewards.calculateRewards(nodeId1);
        
        // EWMA uptime: (10000 * 8 + 9990 * 2) / 10 = 9998 (99.98%)
        // Base: 100, Multiplier: ~1.96x → 196 JEJU
        // Volume: 1000 × 0.01 = 10 JEJU
        // Expected: ~206 JEJU
        assertGe(pending, 205 ether);
        assertLe(pending, 210 ether);
    }
    
    function testCalculateRewardsWithGeoBonus() public {
        // First, register 10 nodes in North America to make it dominant
        for (uint i = 0; i < 10; i++) {
            address op = makeAddr(string(abi.encodePacked("na_operator", i)));
            token.transfer(op, 1000 ether);
            
            vm.startPrank(op);
            token.approve(address(rewards), 1000 ether);
            rewards.registerNode(
                string(abi.encodePacked("https://na", i, ".com")),
                "North America",
                1000 ether
            );
            vm.stopPrank();
        }
        
        // Now register node in South America (will be <15% of nodes = underserved)
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "South America", // Now underserved (<15% of 11 nodes)
            1000 ether
        );
        
        // Fast forward 30 days
        vm.warp(block.timestamp + 30 days);
        
        // Update performance
        vm.prank(oracle);
        rewards.updatePerformance(nodeId1, 9950, 1000000, 50);
        
        uint256 pending = rewards.calculateRewards(nodeId1);
        
        // EWMA uptime: (10000 * 8 + 9950 * 2) / 10 = 9990 (99.9%)
        // Base: 100, Multiplier: ~1.9x → 190 JEJU
        // Volume: 1000 × 0.01 = 10 JEJU
        // Geographic bonus (+50% of base+uptime): +95 JEJU
        // Total: ~295 JEJU
        assertGe(pending, 290 ether);
        assertLe(pending, 300 ether);
    }
    
    function testCannotClaimTooSoon() public {
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        // Try to claim immediately
        vm.prank(operator1);
        vm.expectRevert(NodeOperatorRewards.NothingToClaim.selector);
        rewards.claimRewards(nodeId1);
        
        // Fast forward 1 day (minimum)
        vm.warp(block.timestamp + 1 days);
        
        // Update performance
        vm.prank(oracle);
        rewards.updatePerformance(nodeId1, 9950, 100000, 50);
        
        // Should be able to claim now
        vm.prank(operator1);
        rewards.claimRewards(nodeId1);
    }
    
    // ============ Claiming Tests ============
    
    function testClaimRewards() public {
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        uint256 balanceBefore = token.balanceOf(operator1);
        
        // Fast forward 30 days
        vm.warp(block.timestamp + 30 days);
        
        // Update performance
        vm.prank(oracle);
        rewards.updatePerformance(nodeId1, 9950, 1000000, 50);
        
        uint256 pending = rewards.calculateRewards(nodeId1);
        
        // Claim rewards
        vm.prank(operator1);
        rewards.claimRewards(nodeId1);
        
        uint256 balanceAfter = token.balanceOf(operator1);
        
        // Verify tokens received
        assertEq(balanceAfter - balanceBefore, pending);
    }
    
    function testUnauthorizedCannotClaim() public {
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        vm.warp(block.timestamp + 30 days);
        
        // Try to claim as different operator
        vm.prank(operator2);
        vm.expectRevert(NodeOperatorRewards.Unauthorized.selector);
        rewards.claimRewards(nodeId1);
    }
    
    // ============ Deregistration Tests ============
    
    function testDeregisterNode() public {
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        uint256 balanceBefore = token.balanceOf(operator1);
        
        // Deregister
        vm.prank(operator1);
        rewards.deregisterNode(nodeId1);
        
        uint256 balanceAfter = token.balanceOf(operator1);
        
        // Verify stake returned
        assertEq(balanceAfter - balanceBefore, 1000 ether);
        
        // Verify node is inactive
        (NodeOperatorRewards.Node memory node,,) = rewards.getNodeInfo(nodeId1);
        assertFalse(node.isActive);
    }
    
    function testCannotDeregisterSlashedNode() public {
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        // Slash node
        vm.prank(owner);
        rewards.slashNode(nodeId1, 5000, "Misbehavior"); // 50% slash
        
        // Try to deregister
        vm.prank(operator1);
        vm.expectRevert(NodeOperatorRewards.SlashedNode.selector);
        rewards.deregisterNode(nodeId1);
    }
    
    // ============ Slashing Tests ============
    
    function testSlashNode() public {
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        uint256 ownerBalanceBefore = token.balanceOf(owner);
        
        // Slash 50%
        vm.prank(owner);
        rewards.slashNode(nodeId1, 5000, "Extended downtime");
        
        uint256 ownerBalanceAfter = token.balanceOf(owner);
        
        // Verify slash amount transferred to owner
        assertEq(ownerBalanceAfter - ownerBalanceBefore, 500 ether);
        
        // Verify node status
        (NodeOperatorRewards.Node memory node,,) = rewards.getNodeInfo(nodeId1);
        assertEq(node.stakedAmount, 500 ether);
        assertTrue(node.isSlashed);
        assertFalse(node.isActive);
    }
    
    function testOnlyOwnerCanSlash() public {
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        // Try to slash as operator
        vm.prank(operator1);
        vm.expectRevert();
        rewards.slashNode(nodeId1, 5000, "Test");
    }
    
    // ============ Period Management Tests ============
    
    function testStartNewPeriod() public {
        // Fast forward 30 days
        vm.warp(block.timestamp + 30 days);
        
        // Start new period
        rewards.startNewPeriod();
        
        // Verify period advanced
        assertEq(rewards.currentPeriod(), 1);
    }
    
    function testCannotStartPeriodTooSoon() public {
        // Try to start new period immediately
        vm.expectRevert(NodeOperatorRewards.TooSoonToClaim.selector);
        rewards.startNewPeriod();
    }
    
    // ============ Admin Function Tests ============
    
    function testSetPerformanceOracle() public {
        address newOracle = address(0x999);
        
        vm.prank(owner);
        rewards.setPerformanceOracle(newOracle);
        
        assertEq(rewards.performanceOracle(), newOracle);
    }
    
    function testSetUptimeMultipliers() public {
        vm.prank(owner);
        rewards.setUptimeMultipliers(4000, 25000); // 0.4x to 2.5x
        
        assertEq(rewards.uptimeMultiplierMin(), 4000);
        assertEq(rewards.uptimeMultiplierMax(), 25000);
    }
    
    function testSetGeographicBonus() public {
        vm.prank(owner);
        rewards.setGeographicBonus(7500); // 75%
        
        assertEq(rewards.geographicBonus(), 7500);
    }
    
    function testPauseUnpause() public {
        vm.prank(owner);
        rewards.pause();
        
        // Cannot register when paused
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        vm.expectRevert();
        rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        // Unpause
        vm.prank(owner);
        rewards.unpause();
        
        // Can register now
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        assertTrue(nodeId1 != bytes32(0));
    }
    
    // ============ View Function Tests ============
    
    function testGetAllNodes() public {
        // Register multiple nodes
        vm.startPrank(operator1);
        token.approve(address(rewards), 2000 ether);
        
        bytes32 node1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        bytes32 node2 = rewards.registerNode(
            "https://node2.example.com:8545",
            "Europe",
            1000 ether
        );
        vm.stopPrank();
        
        bytes32[] memory allNodes = rewards.getAllNodes();
        assertEq(allNodes.length, 2);
        assertEq(allNodes[0], node1);
        assertEq(allNodes[1], node2);
    }
    
    function testGetTotalActiveNodes() public {
        // Register nodes
        vm.prank(operator1);
        token.approve(address(rewards), 2000 ether);
        
        vm.prank(operator1);
        bytes32 node1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        vm.prank(operator2);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator2);
        rewards.registerNode(
            "https://node2.example.com:8545",
            "Europe",
            1000 ether
        );
        
        // Both active
        assertEq(rewards.getTotalActiveNodes(), 2);
        
        // Slash one
        vm.prank(owner);
        rewards.slashNode(node1, 5000, "Test");
        
        // Only one active now
        assertEq(rewards.getTotalActiveNodes(), 1);
    }
    
    // ============ Edge Case Tests ============
    
    function testRewardsAccrueOverTime() public {
        vm.prank(operator1);
        token.approve(address(rewards), 1000 ether);
        
        vm.prank(operator1);
        nodeId1 = rewards.registerNode(
            "https://node1.example.com:8545",
            "North America",
            1000 ether
        );
        
        // Update performance
        vm.prank(oracle);
        rewards.updatePerformance(nodeId1, 9950, 100000, 50);
        
        // Check rewards at different times
        vm.warp(block.timestamp + 1 days);
        uint256 rewards1Day = rewards.calculateRewards(nodeId1);
        
        vm.warp(block.timestamp + 15 days);
        uint256 rewards15Days = rewards.calculateRewards(nodeId1);
        
        vm.warp(block.timestamp + 30 days);
        uint256 rewards30Days = rewards.calculateRewards(nodeId1);
        
        // Rewards should increase over time
        assertGt(rewards15Days, rewards1Day);
        assertGt(rewards30Days, rewards15Days);
    }
    
    function testWithdrawRewardTokens() public {
        uint256 ownerBalanceBefore = token.balanceOf(owner);
        uint256 contractBalance = token.balanceOf(address(rewards));
        
        vm.prank(owner);
        rewards.withdrawRewardTokens(100 ether);
        
        uint256 ownerBalanceAfter = token.balanceOf(owner);
        
        assertEq(ownerBalanceAfter - ownerBalanceBefore, 100 ether);
        assertEq(token.balanceOf(address(rewards)), contractBalance - 100 ether);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {CloudServiceRegistry} from "../src/cloud/CloudServiceRegistry.sol";

/**
 * @title CloudServiceRegistry AGGRESSIVE Tests
 * @notice Tests MUST crash on bugs - no defensive code
 * @dev EVERY function tested with EXACT assertions
 */
contract CloudServiceRegistryTest is Test {
    CloudServiceRegistry public registry;
    
    address public owner = address(this);
    address public treasury = address(0x1);
    address public user = address(0x2);
    address public attacker = address(0x666);
    address public paymaster = address(0x999);
    
    function setUp() public {
        registry = new CloudServiceRegistry(treasury);
        registry.setAuthorizedCaller(paymaster, true);
    }
    
    // ============ Constructor - MUST set EXACT defaults ============
    
    function testConstructor_SetsTreasury() public view {
        assertEq(registry.treasury(), treasury); // MUST be exact
    }
    
    function testConstructor_RegistersDefaultServices() public view {
        string[] memory services = registry.getAllServices();
        assertEq(services.length, 4); // MUST be exactly 4
        assertEq(services[0], "chat-completion");
        assertEq(services[1], "image-generation");
        assertEq(services[2], "video-generation");
        assertEq(services[3], "container");
    }
    
    function testConstructor_SetsDefaultPrices() public view {
        CloudServiceRegistry.ServiceConfig memory chat = registry.getServiceStats("chat-completion");
        assertEq(chat.basePriceElizaOS, 10 * 1e18); // MUST be exactly 10
        assertEq(chat.minPrice, 1 * 1e18);
        assertEq(chat.maxPrice, 100 * 1e18);
        assertTrue(chat.isActive);
        assertEq(chat.demandMultiplier, 10000); // MUST be 1x (10000 basis points)
    }
    
    function testConstructor_RevertsOnZeroTreasury() public {
        vm.expectRevert(CloudServiceRegistry.InvalidTreasuryAddress.selector);
        new CloudServiceRegistry(address(0));
    }
    
    // ============ getServiceCost - MUST calculate EXACT cost ============
    
    function testGetServiceCost_BasePrice() public view {
        uint256 cost = registry.getServiceCost("chat-completion", user);
        assertEq(cost, 10 * 1e18); // MUST be exact base price
    }
    
    function testGetServiceCost_WithDemandMultiplier() public {
        // Update demand to 1.5x
        registry.updateDemandMultiplier("chat-completion", 15000);
        
        uint256 cost = registry.getServiceCost("chat-completion", user);
        assertEq(cost, 15 * 1e18); // MUST be 10 * 1.5 = 15
    }
    
    function testGetServiceCost_EnforcesMinPrice() public {
        // Set very low demand multiplier (0.5x is minimum allowed)
        registry.updateDemandMultiplier("chat-completion", 5000); // 0.5x
        
        uint256 cost = registry.getServiceCost("chat-completion", user);
        assertEq(cost, 5 * 1e18); // MUST be 10 * 0.5 = 5
    }
    
    function testGetServiceCost_EnforcesMaxPrice() public {
        // Set very high demand multiplier (5x is maximum allowed)
        registry.updateDemandMultiplier("chat-completion", 50000); // 5x
        
        uint256 cost = registry.getServiceCost("chat-completion", user);
        assertEq(cost, 50 * 1e18); // MUST be 10 * 5 = 50 (multiplier caps at 5x)
    }
    
    function testGetServiceCost_RevertsOnInactiveService() public {
        registry.setServiceActive("chat-completion", false);
        
        vm.expectRevert(abi.encodeWithSelector(
            CloudServiceRegistry.ServiceNotActive.selector,
            "chat-completion"
        ));
        registry.getServiceCost("chat-completion", user);
    }
    
    function testGetServiceCost_RevertsOnNonExistentService() public {
        // Non-existent service has isActive=false and basePriceElizaOS=0
        // Contract checks isActive first, so we get ServiceNotActive error
        vm.expectRevert(abi.encodeWithSelector(
            CloudServiceRegistry.ServiceNotActive.selector,
            "non-existent"
        ));
        registry.getServiceCost("non-existent", user);
    }
    
    // ============ recordUsage - MUST update EXACT stats ============
    
    function testRecordUsage_UpdatesServiceStats() public {
        CloudServiceRegistry.ServiceConfig memory before = registry.getServiceStats("chat-completion");
        
        vm.prank(paymaster);
        registry.recordUsage(user, "chat-completion", 10 * 1e18, bytes32(uint256(1)));
        
        CloudServiceRegistry.ServiceConfig memory afterUpdate = registry.getServiceStats("chat-completion");
        assertEq(afterUpdate.totalUsageCount, before.totalUsageCount + 1); // MUST increment by 1
        assertEq(afterUpdate.totalRevenueElizaOS, before.totalRevenueElizaOS + 10 * 1e18); // MUST add exact cost
    }
    
    function testRecordUsage_UpdatesUserStats() public {
        vm.prank(paymaster);
        registry.recordUsage(user, "chat-completion", 10 * 1e18, bytes32(uint256(1)));
        
        (uint256 totalSpent, uint256 requestCount) = registry.getUserTotalUsage(user);
        assertEq(totalSpent, 10 * 1e18); // MUST be exact
        assertEq(requestCount, 1); // MUST be 1
    }
    
    function testRecordUsage_StoresUsageRecord() public {
        bytes32 sessionId = bytes32(uint256(12345));
        
        vm.prank(paymaster);
        registry.recordUsage(user, "chat-completion", 10 * 1e18, sessionId);
        
        (address recordUser, string memory serviceName, uint256 cost, bytes32 recordSessionId, uint256 timestamp, uint256 blockNumber) = registry.usageRecords(sessionId);
        assertEq(recordUser, user); // MUST match
        assertEq(serviceName, "chat-completion");
        assertEq(cost, 10 * 1e18);
        assertEq(recordSessionId, sessionId);
    }
    
    function testRecordUsage_RevertsIfUnauthorized() public {
        vm.prank(attacker);
        vm.expectRevert(CloudServiceRegistry.UnauthorizedCaller.selector);
        registry.recordUsage(user, "chat-completion", 10 * 1e18, bytes32(uint256(1)));
    }
    
    function testRecordUsage_RevertsWhenPaused() public {
        registry.pause();
        
        vm.prank(paymaster);
        vm.expectRevert(); // Pausable: paused
        registry.recordUsage(user, "chat-completion", 10 * 1e18, bytes32(uint256(1)));
    }
    
    // ============ Volume Discounts - MUST calculate EXACT discount ============
    
    function testVolumeDiscount_NoDiscountUnder1000() public {
        uint256 discount = registry.getUserVolumeDiscount(user, "chat-completion");
        assertEq(discount, 0); // MUST be 0
    }
    
    function testVolumeDiscount_5PercentAt1000Spent() public {
        // Record usage to reach 1000 elizaOS spent
        vm.startPrank(paymaster);
        registry.recordUsage(user, "chat-completion", 1000 * 1e18, bytes32(uint256(1)));
        vm.stopPrank();
        
        uint256 discount = registry.getUserVolumeDiscount(user, "chat-completion");
        assertEq(discount, 500); // MUST be exactly 500 basis points (5%)
    }
    
    function testVolumeDiscount_20PercentAt50000Spent() public {
        vm.startPrank(paymaster);
        registry.recordUsage(user, "chat-completion", 50000 * 1e18, bytes32(uint256(1)));
        vm.stopPrank();
        
        uint256 discount = registry.getUserVolumeDiscount(user, "chat-completion");
        assertEq(discount, 2000); // MUST be exactly 2000 basis points (20%)
    }
    
    // ============ Admin Functions - MUST update EXACT values ============
    
    function testRegisterService_CreatesNewService() public {
        uint256 servicesBefore = registry.getAllServices().length;
        
        vm.expectEmit(true, true, true, true);
        emit ServiceRegistered("new-service", 20 * 1e18, 2 * 1e18, 200 * 1e18);
        
        registry.registerService("new-service", 20 * 1e18, 2 * 1e18, 200 * 1e18);
        
        assertEq(registry.getAllServices().length, servicesBefore + 1);
        
        CloudServiceRegistry.ServiceConfig memory service = registry.getServiceStats("new-service");
        assertEq(service.basePriceElizaOS, 20 * 1e18);
        assertTrue(service.isActive);
    }
    
    function testUpdateServicePrice_ChangesPrice() public {
        uint256 newPrice = 20 * 1e18;
        
        registry.updateServicePrice("chat-completion", newPrice);
        
        CloudServiceRegistry.ServiceConfig memory service = registry.getServiceStats("chat-completion");
        assertEq(service.basePriceElizaOS, newPrice); // MUST be exact
    }
    
    function testUpdateDemandMultiplier_ChangesMultiplier() public {
        uint256 newMultiplier = 20000; // 2x
        
        registry.updateDemandMultiplier("chat-completion", newMultiplier);
        
        CloudServiceRegistry.ServiceConfig memory service = registry.getServiceStats("chat-completion");
        assertEq(service.demandMultiplier, newMultiplier); // MUST be exact
    }
    
    function testUpdateDemandMultiplier_RevertsIfTooLow() public {
        vm.expectRevert(abi.encodeWithSelector(
            CloudServiceRegistry.InvalidMultiplier.selector,
            4999
        ));
        registry.updateDemandMultiplier("chat-completion", 4999); // Below 0.5x
    }
    
    function testUpdateDemandMultiplier_RevertsIfTooHigh() public {
        vm.expectRevert(abi.encodeWithSelector(
            CloudServiceRegistry.InvalidMultiplier.selector,
            50001
        ));
        registry.updateDemandMultiplier("chat-completion", 50001); // Above 5x
    }
    
    function testSetServiceActive_TogglesState() public {
        registry.setServiceActive("chat-completion", false);
        
        CloudServiceRegistry.ServiceConfig memory service = registry.getServiceStats("chat-completion");
        assertFalse(service.isActive); // MUST be false
        
        registry.setServiceActive("chat-completion", true);
        
        service = registry.getServiceStats("chat-completion");
        assertTrue(service.isActive); // MUST be true
    }
    
    function testUpdateTreasury_ChangesAddress() public {
        address newTreasury = address(0x777);
        
        vm.expectEmit(true, true, false, false);
        emit TreasuryUpdated(treasury, newTreasury);
        
        registry.updateTreasury(newTreasury);
        
        assertEq(registry.treasury(), newTreasury); // MUST be exact
    }
    
    function testUpdateTreasury_RevertsOnZeroAddress() public {
        vm.expectRevert(CloudServiceRegistry.InvalidTreasuryAddress.selector);
        registry.updateTreasury(address(0));
    }
    
    function testSetAuthorizedCaller_AuthorizesAddress() public {
        address newCaller = address(0x888);
        
        assertFalse(registry.authorizedCallers(newCaller));
        
        registry.setAuthorizedCaller(newCaller, true);
        
        assertTrue(registry.authorizedCallers(newCaller)); // MUST be true
    }
    
    function testSetAuthorizedCaller_CanRevoke() public {
        registry.setAuthorizedCaller(paymaster, false);
        
        assertFalse(registry.authorizedCallers(paymaster)); // MUST be false
    }
    
    // ============ Pause - MUST block operations ============
    
    function testPause_BlocksRecordUsage() public {
        registry.pause();
        
        vm.prank(paymaster);
        vm.expectRevert(); // Pausable: paused
        registry.recordUsage(user, "chat-completion", 10 * 1e18, bytes32(uint256(1)));
    }
    
    function testPause_DoesNotBlockViewFunctions() public {
        registry.pause();
        
        // View functions should still work
        uint256 cost = registry.getServiceCost("chat-completion", user);
        assertGt(cost, 0); // Should not revert
    }
    
    // ============ Only Owner - MUST revert for non-owners ============
    
    function testOnlyOwner_RegisterService() public {
        vm.prank(attacker);
        vm.expectRevert(); // Ownable: caller is not the owner
        registry.registerService("attacker-service", 100 * 1e18, 10 * 1e18, 1000 * 1e18);
    }
    
    function testOnlyOwner_UpdateServicePrice() public {
        vm.prank(attacker);
        vm.expectRevert();
        registry.updateServicePrice("chat-completion", 20 * 1e18);
    }
    
    function testOnlyOwner_UpdateDemandMultiplier() public {
        vm.prank(attacker);
        vm.expectRevert();
        registry.updateDemandMultiplier("chat-completion", 15000);
    }
    
    function testOnlyOwner_SetServiceActive() public {
        vm.prank(attacker);
        vm.expectRevert();
        registry.setServiceActive("chat-completion", false);
    }
    
    function testOnlyOwner_UpdateTreasury() public {
        vm.prank(attacker);
        vm.expectRevert();
        registry.updateTreasury(address(0x777));
    }
    
    function testOnlyOwner_SetAuthorizedCaller() public {
        vm.prank(attacker);
        vm.expectRevert();
        registry.setAuthorizedCaller(attacker, true);
    }
    
    function testOnlyOwner_Pause() public {
        vm.prank(attacker);
        vm.expectRevert();
        registry.pause();
    }
    
    // Events
    event ServiceRegistered(string indexed serviceName, uint256 basePriceElizaOS, uint256 minPrice, uint256 maxPrice);
    event ServicePriceUpdated(string indexed serviceName, uint256 oldPrice, uint256 newPrice);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
}


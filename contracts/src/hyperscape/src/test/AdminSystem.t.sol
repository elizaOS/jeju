// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { IWorld } from "../codegen/world/IWorld.sol";
import { WorldConfig, WorldConfigData, ItemMetadata, ItemMetadataData, MobLootTable, MobLootTableData } from "../codegen/index.sol";
import { MobType } from "../codegen/common.sol";

contract AdminSystemTest is MudTest {
    IWorld world;
    
    address admin = address(this);
    address notAdmin = address(0x123);
    
    function setUp() public override {
        super.setUp();
        world = IWorld(worldAddress);
    }
    
    function testInitialize() public {
        world.hyperscape__initialize();
        
        WorldConfigData memory config = WorldConfig.get();
        assertTrue(config.initialized, "World should be initialized");
        assertTrue(config.respawnEnabled, "Respawn should be enabled");
        assertFalse(config.pvpEnabled, "PVP should be disabled");
        assertEq(config.adminAddress, admin, "Admin should be set");
    }
    
    function testCannotInitializeTwice() public {
        world.hyperscape__initialize();
        
        vm.expectRevert("World already initialized");
        world.hyperscape__initialize();
    }
    
    function testDefaultItemsCreated() public {
        world.hyperscape__initialize();
        
        // Check some default items exist
        ItemMetadataData memory logs = ItemMetadata.get(1);
        assertEq(logs.name, "Logs", "Logs should exist");
        
        ItemMetadataData memory sword = ItemMetadata.get(100);
        assertEq(sword.name, "Bronze Sword", "Bronze Sword should exist");
        assertEq(sword.attackBonus, 4, "Bronze Sword attack bonus");
        assertEq(sword.strengthBonus, 5, "Bronze Sword strength bonus");
    }
    
    function testDefaultLootTablesCreated() public {
        world.hyperscape__initialize();
        
        MobLootTableData memory goblinLoot = MobLootTable.get(MobType(0));
        assertEq(goblinLoot.coinMin, 1, "Goblin min coins");
        assertEq(goblinLoot.coinMax, 5, "Goblin max coins");
    }
    
    function testCreateItem() public {
        world.hyperscape__initialize();
        
        world.hyperscape__createItem(
            999,
            "Test Item",
            0, // WEAPON
            false,
            10, // attackBonus
            12, // strengthBonus
            0,
            0,
            5, // reqAttack
            5, // reqStrength
            0,
            0,
            0
        );
        
        ItemMetadataData memory item = ItemMetadata.get(999);
        assertEq(item.name, "Test Item", "Item name should match");
        assertEq(item.attackBonus, 10, "Attack bonus should match");
        assertEq(item.strengthBonus, 12, "Strength bonus should match");
    }
    
    function testOnlyAdminCanCreateItem() public {
        world.hyperscape__initialize();
        
        vm.prank(notAdmin);
        vm.expectRevert("Not admin");
        world.hyperscape__createItem(999, "Hack", 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
    
    function testSetLootTable() public {
        world.hyperscape__initialize();
        
        world.hyperscape__setLootTable(
            0, // Goblin
            10, // coinMin
            20, // coinMax
            999, // itemId1
            1000, // 10% chance
            0, 0, 0, 0, 0, 0
        );
        
        MobLootTableData memory loot = MobLootTable.get(MobType(0));
        assertEq(loot.coinMin, 10, "Min coins updated");
        assertEq(loot.coinMax, 20, "Max coins updated");
        assertEq(loot.itemId1, 999, "Item ID updated");
        assertEq(loot.itemId1Chance, 1000, "Item chance updated");
    }
    
    function testOnlyAdminCanSetLootTable() public {
        world.hyperscape__initialize();
        
        vm.prank(notAdmin);
        vm.expectRevert("Not admin");
        world.hyperscape__setLootTable(0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0);
    }
    
    function testCannotCreateInvalidItem() public {
        world.hyperscape__initialize();
        
        vm.expectRevert("Invalid item");
        world.hyperscape__createItem(0, "Bad", 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0); // ID 0
        
        vm.expectRevert("Invalid item");
        world.hyperscape__createItem(1, "", 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0); // Empty name
    }
    
    function testCannotSetInvalidLootTable() public {
        world.hyperscape__initialize();
        
        vm.expectRevert("Invalid config");
        world.hyperscape__setLootTable(9, 1, 5, 0, 0, 0, 0, 0, 0, 0, 0); // Invalid mob type
        
        vm.expectRevert("Invalid config");
        world.hyperscape__setLootTable(0, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0); // coinMax < coinMin
    }
    
    function testAllItemsCreated() public {
        world.hyperscape__initialize();
        
        // Verify key items exist
        assertTrue(bytes(ItemMetadata.get(1).name).length > 0, "Logs");
        assertTrue(bytes(ItemMetadata.get(10).name).length > 0, "Raw Shrimp");
        assertTrue(bytes(ItemMetadata.get(11).name).length > 0, "Cooked Shrimp");
        assertTrue(bytes(ItemMetadata.get(50).name).length > 0, "Bronze Hatchet");
        assertTrue(bytes(ItemMetadata.get(100).name).length > 0, "Bronze Sword");
        assertTrue(bytes(ItemMetadata.get(150).name).length > 0, "Wood Bow");
        assertTrue(bytes(ItemMetadata.get(200).name).length > 0, "Bronze Shield");
        assertTrue(bytes(ItemMetadata.get(300).name).length > 0, "Leather Helmet");
        assertTrue(bytes(ItemMetadata.get(350).name).length > 0, "Leather Body");
        assertTrue(bytes(ItemMetadata.get(400).name).length > 0, "Leather Legs");
    }
}

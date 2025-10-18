// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { IWorld } from "../codegen/world/IWorld.sol";
import { Player, InventorySlot, InventorySlotData } from "../codegen/index.sol";

contract InventorySystemTest is MudTest {
    IWorld world;
    
    address player1 = address(0x1);
    
    function setUp() public override {
        super.setUp();
        world = IWorld(worldAddress);
        
        // Initialize world (creates default items and loot tables)
        world.hyperscape__initialize();
        
        // Register test player
        vm.prank(player1);
        world.hyperscape__register("Player1");
    }
    
    function testAddItem() public {
        (bool success, uint8 slot) = world.hyperscape__addItem(player1, 1, 5);
        
        assertTrue(success, "Should successfully add item");
        assertEq(slot, 0, "Should be in slot 0");
        
        InventorySlotData memory slotData = InventorySlot.get(player1, 0);
        assertEq(slotData.itemId, 1, "Item ID should be 1");
        assertEq(slotData.quantity, 5, "Quantity should be 5");
    }
    
    function testAddStackableItems() public {
        world.hyperscape__addItem(player1, 1, 3);
        world.hyperscape__addItem(player1, 1, 2);
        
        InventorySlotData memory slotData = InventorySlot.get(player1, 0);
        assertEq(slotData.quantity, 5, "Should stack to 5");
    }
    
    function testAddNonStackableItems() public {
        world.hyperscape__addItem(player1, 100, 1); // Bronze Sword
        (bool success, uint8 slot) = world.hyperscape__addItem(player1, 100, 1); // Another sword
        
        assertTrue(success, "Should add second sword");
        assertEq(slot, 1, "Should be in slot 1");
    }
    
    function testRemoveItem() public {
        world.hyperscape__addItem(player1, 1, 10);
        
        bool success = world.hyperscape__removeItem(player1, 0, 5);
        assertTrue(success, "Should successfully remove");
        
        InventorySlotData memory slotData = InventorySlot.get(player1, 0);
        assertEq(slotData.quantity, 5, "Should have 5 remaining");
    }
    
    function testRemoveAllItems() public {
        world.hyperscape__addItem(player1, 1, 10);
        
        world.hyperscape__removeItem(player1, 0, 10);
        
        InventorySlotData memory slotData = InventorySlot.get(player1, 0);
        assertEq(slotData.itemId, 0, "Slot should be empty");
        assertEq(slotData.quantity, 0, "Quantity should be 0");
    }
    
    function testMoveItem() public {
        world.hyperscape__addItem(player1, 1, 5);
        
        vm.prank(player1);
        world.hyperscape__moveItem(player1, 0, 5);
        
        InventorySlotData memory slot0 = InventorySlot.get(player1, 0);
        InventorySlotData memory slot5 = InventorySlot.get(player1, 5);
        
        assertEq(slot0.itemId, 0, "Slot 0 should be empty");
        assertEq(slot5.itemId, 1, "Slot 5 should have the item");
        assertEq(slot5.quantity, 5, "Should have 5 items");
    }
    
    function testMoveItemToOccupiedSlot() public {
        world.hyperscape__addItem(player1, 1, 5);
        world.hyperscape__addItem(player1, 10, 3);
        
        vm.prank(player1);
        world.hyperscape__moveItem(player1, 0, 1);
        
        InventorySlotData memory slot0 = InventorySlot.get(player1, 0);
        InventorySlotData memory slot1 = InventorySlot.get(player1, 1);
        
        assertEq(slot0.itemId, 10, "Slot 0 should have item 10");
        assertEq(slot1.itemId, 1, "Slot 1 should have item 1");
    }
    
    function testStackWhenMoving() public {
        world.hyperscape__addItem(player1, 1, 3);
        world.hyperscape__addItem(player1, 1, 2);
        
        vm.prank(player1);
        world.hyperscape__moveItem(player1, 0, 1);
        
        InventorySlotData memory slot0 = InventorySlot.get(player1, 0);
        InventorySlotData memory slot1 = InventorySlot.get(player1, 1);
        
        assertEq(slot0.itemId, 0, "Slot 0 should be empty");
        assertEq(slot1.quantity, 5, "Should have stacked to 5");
    }
    
    function testHasItem() public {
        world.hyperscape__addItem(player1, 1, 5);
        world.hyperscape__addItem(player1, 1, 3);
        
        (bool found, uint32 quantity) = world.hyperscape__hasItem(player1, 1);
        assertTrue(found, "Should find item");
        assertEq(quantity, 8, "Should have total of 8");
    }
    
    function testGetFreeSlots() public {
        uint8 free = world.hyperscape__getFreeSlots(player1);
        assertEq(free, 28, "Should have 28 free slots");
        
        world.hyperscape__addItem(player1, 1, 1);
        world.hyperscape__addItem(player1, 10, 1);
        
        free = world.hyperscape__getFreeSlots(player1);
        assertEq(free, 26, "Should have 26 free slots");
    }
    
    function testFindItem() public {
        world.hyperscape__addItem(player1, 1, 5);
        world.hyperscape__addItem(player1, 10, 3);
        world.hyperscape__addItem(player1, 100, 1);
        
        (bool found, uint8 slot) = world.hyperscape__findItem(player1, 10);
        assertTrue(found, "Should find item 10");
        assertEq(slot, 1, "Should be in slot 1");
    }
    
    function testInventoryFull() public {
        // Fill inventory with non-stackable items
        for (uint8 i = 0; i < 28; i++) {
            world.hyperscape__addItem(player1, 100 + i, 1);
        }
        
        (bool success, ) = world.hyperscape__addItem(player1, 200, 1);
        assertFalse(success, "Should fail when inventory full");
    }
}


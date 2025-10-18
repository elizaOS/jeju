// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { IWorld } from "../codegen/world/IWorld.sol";
import { Player, Equipment, EquipmentData, InventorySlot, InventorySlotData } from "../codegen/index.sol";

contract EquipmentSystemTest is MudTest {
    IWorld world;
    
    address player1 = address(0x1);
    
    function setUp() public override {
        super.setUp();
        world = IWorld(worldAddress);
        world.hyperscape__initialize();
        
        vm.prank(player1);
        world.hyperscape__register("Player1");
    }
    
    function testEquipWeapon() public {
        world.hyperscape__addItem(player1, 100, 1); // Bronze Sword
        
        vm.prank(player1);
        world.hyperscape__equipItem(0);
        
        EquipmentData memory equipment = Equipment.get(player1);
        assertEq(equipment.weapon, 100, "Weapon should be equipped");
        
        InventorySlotData memory slot = InventorySlot.get(player1, 0);
        assertEq(slot.itemId, 0, "Inventory slot should be empty");
    }
    
    function testUnequipWeapon() public {
        world.hyperscape__addItem(player1, 100, 1);
        
        vm.startPrank(player1);
        world.hyperscape__equipItem(0);
        world.hyperscape__unequipItem(0); // Unequip weapon slot
        vm.stopPrank();
        
        EquipmentData memory equipment = Equipment.get(player1);
        assertEq(equipment.weapon, 0, "Weapon should be unequipped");
        
        InventorySlotData memory slot = InventorySlot.get(player1, 0);
        assertEq(slot.itemId, 100, "Item should be back in inventory");
    }
    
    function testSwapWeapons() public {
        world.hyperscape__addItem(player1, 100, 1); // Bronze Sword (slot 0)
        world.hyperscape__addItem(player1, 101, 1); // Steel Sword (slot 1)
        
        vm.startPrank(player1);
        world.hyperscape__equipItem(0); // Equip bronze sword from slot 0
        
        EquipmentData memory equipment1 = Equipment.get(player1);
        assertEq(equipment1.weapon, 100, "Bronze sword should be equipped");
        
        // Verify inventory state after first equip
        InventorySlotData memory slot0After = InventorySlot.get(player1, 0);
        InventorySlotData memory slot1After = InventorySlot.get(player1, 1);
        assertEq(slot0After.itemId, 0, "Slot 0 should be empty after equipping");
        assertEq(slot1After.itemId, 101, "Slot 1 should still have steel sword");
        
        // After equipping from slot 0, slot 0 is now empty, steel sword is still in slot 1
        world.hyperscape__equipItem(1); // Equip steel sword from slot 1
        
        EquipmentData memory equipment2 = Equipment.get(player1);
        assertEq(equipment2.weapon, 101, "Steel sword should be equipped");
        
        // Bronze sword should be back in inventory (goes to first empty slot, which is slot 0)
        InventorySlotData memory finalSlot0 = InventorySlot.get(player1, 0);
        InventorySlotData memory finalSlot1 = InventorySlot.get(player1, 1);
        assertEq(finalSlot0.itemId, 100, "Bronze sword should be back in inventory at slot 0");
        assertEq(finalSlot1.itemId, 0, "Slot 1 should be empty after equipping");
        vm.stopPrank();
    }
    
    function testEquipShield() public {
        world.hyperscape__addItem(player1, 200, 1); // Bronze Shield
        
        vm.prank(player1);
        world.hyperscape__equipItem(0);
        
        EquipmentData memory equipment = Equipment.get(player1);
        assertEq(equipment.shield, 200, "Shield should be equipped");
    }
    
    function testEquipHelmet() public {
        world.hyperscape__addItem(player1, 300, 1); // Leather Helmet
        
        vm.prank(player1);
        world.hyperscape__equipItem(0);
        
        EquipmentData memory equipment = Equipment.get(player1);
        assertEq(equipment.helmet, 300, "Helmet should be equipped");
    }
    
    function testEquipBody() public {
        world.hyperscape__addItem(player1, 350, 1); // Leather Body
        
        vm.prank(player1);
        world.hyperscape__equipItem(0);
        
        EquipmentData memory equipment = Equipment.get(player1);
        assertEq(equipment.body, 350, "Body armor should be equipped");
    }
    
    function testEquipLegs() public {
        world.hyperscape__addItem(player1, 400, 1); // Leather Legs
        
        vm.prank(player1);
        world.hyperscape__equipItem(0);
        
        EquipmentData memory equipment = Equipment.get(player1);
        assertEq(equipment.legs, 400, "Leg armor should be equipped");
    }
    
    function testEquipArrows() public {
        world.hyperscape__addItem(player1, 60, 100); // Arrows
        
        vm.prank(player1);
        world.hyperscape__equipItem(0);
        
        EquipmentData memory equipment = Equipment.get(player1);
        assertEq(equipment.arrows, 60, "Arrows should be equipped");
    }
    
    function testEquipTool() public {
        world.hyperscape__addItem(player1, 50, 1); // Bronze Hatchet
        
        vm.prank(player1);
        world.hyperscape__equipItem(0);
        
        EquipmentData memory equipment = Equipment.get(player1);
        assertEq(equipment.weapon, 50, "Tool should be in weapon slot");
    }
    
    function testCannotEquipConsumable() public {
        world.hyperscape__addItem(player1, 11, 5); // Cooked Shrimp
        
        vm.prank(player1);
        vm.expectRevert("Cannot equip this item type");
        world.hyperscape__equipItem(0);
    }
    
    function testCannotEquipResource() public {
        world.hyperscape__addItem(player1, 1, 10); // Logs
        
        vm.prank(player1);
        vm.expectRevert("Cannot equip this item type");
        world.hyperscape__equipItem(0);
    }
    
    function testUnequipToFullInventory() public {
        world.hyperscape__addItem(player1, 100, 1); // Sword
        
        vm.startPrank(player1);
        world.hyperscape__equipItem(0);
        
        // Fill inventory
        for (uint8 i = 0; i < 28; i++) {
            world.hyperscape__addItem(player1, 100 + i, 1);
        }
        
        vm.expectRevert("Inventory full");
        world.hyperscape__unequipItem(0);
        vm.stopPrank();
    }
    
    function testFullEquipmentSet() public {
        world.hyperscape__addItem(player1, 100, 1); // Sword
        world.hyperscape__addItem(player1, 200, 1); // Shield
        world.hyperscape__addItem(player1, 300, 1); // Helmet
        world.hyperscape__addItem(player1, 350, 1); // Body
        world.hyperscape__addItem(player1, 400, 1); // Legs
        world.hyperscape__addItem(player1, 60, 100); // Arrows
        
        vm.startPrank(player1);
        for (uint8 i = 0; i < 6; i++) {
            world.hyperscape__equipItem(i);
        }
        vm.stopPrank();
        
        EquipmentData memory equipment = Equipment.get(player1);
        assertEq(equipment.weapon, 100, "Weapon equipped");
        assertEq(equipment.shield, 200, "Shield equipped");
        assertEq(equipment.helmet, 300, "Helmet equipped");
        assertEq(equipment.body, 350, "Body equipped");
        assertEq(equipment.legs, 400, "Legs equipped");
        assertEq(equipment.arrows, 60, "Arrows equipped");
    }
}


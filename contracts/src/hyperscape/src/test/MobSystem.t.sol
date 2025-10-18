// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { IWorld } from "../codegen/world/IWorld.sol";
import { Mob, MobData } from "../codegen/index.sol";

contract MobSystemTest is MudTest {
    IWorld world;
    
    function setUp() public override {
        super.setUp();
        world = IWorld(worldAddress);
        world.hyperscape__initialize();
    }
    
    function testSpawnGoblin() public {
        bytes32 mobId = world.hyperscape__spawnMob(0, 100, 10, 100, 1);
        
        MobData memory mob = Mob.get(mobId);
        assertTrue(mob.isAlive, "Mob should be alive");
        assertEq(mob.health, 25, "Goblin should have 25 HP");
        assertEq(mob.maxHealth, 25, "Goblin max HP should be 25");
    }
    
    function testSpawnBandit() public {
        bytes32 mobId = world.hyperscape__spawnMob(1, 200, 10, 200, 2);
        
        MobData memory mob = Mob.get(mobId);
        assertEq(mob.health, 28, "Bandit should have 28 HP");
    }
    
    function testSpawnBarbarian() public {
        bytes32 mobId = world.hyperscape__spawnMob(2, 300, 10, 300, 3);
        
        MobData memory mob = Mob.get(mobId);
        assertEq(mob.health, 30, "Barbarian should have 30 HP");
    }
    
    function testSpawnHighLevelMobs() public {
        bytes32 hobgoblinId = world.hyperscape__spawnMob(3, 400, 10, 400, 4);
        bytes32 guardId = world.hyperscape__spawnMob(4, 500, 10, 500, 5);
        bytes32 darkWarriorId = world.hyperscape__spawnMob(5, 600, 10, 600, 6);
        
        assertEq(Mob.getHealth(hobgoblinId), 50, "Hobgoblin HP");
        assertEq(Mob.getHealth(guardId), 60, "Guard HP");
        assertEq(Mob.getHealth(darkWarriorId), 75, "Dark Warrior HP");
    }
    
    function testSpawnEndgameMobs() public {
        bytes32 blackKnightId = world.hyperscape__spawnMob(6, 700, 10, 700, 7);
        bytes32 iceWarriorId = world.hyperscape__spawnMob(7, 800, 10, 800, 8);
        bytes32 darkRangerId = world.hyperscape__spawnMob(8, 900, 10, 900, 9);
        
        assertEq(Mob.getHealth(blackKnightId), 100, "Black Knight HP");
        assertEq(Mob.getHealth(iceWarriorId), 120, "Ice Warrior HP");
        assertEq(Mob.getHealth(darkRangerId), 150, "Dark Ranger HP");
    }
    
    function testCannotRespawnAlive() public {
        bytes32 mobId = world.hyperscape__spawnMob(0, 100, 10, 100, 1);
        
        vm.expectRevert("Mob is already alive");
        world.hyperscape__respawnMob(mobId);
    }
    
    function testCannotRespawnTooEarly() public {
        bytes32 mobId = world.hyperscape__spawnMob(0, 100, 10, 100, 1);
        
        // Kill mob by dealing fatal damage through combat
        // First register a player to attack it
        address attacker = address(0x123);
        vm.prank(attacker);
        world.hyperscape__register("Attacker");
        
        // Attack until dead
        vm.startPrank(attacker);
        for (uint256 i = 0; i < 100; i++) {
            MobData memory mobState = Mob.get(mobId);
            if (!mobState.isAlive) break;
            world.hyperscape__attackMob(mobId);
        }
        vm.stopPrank();
        
        // Try to respawn immediately (should fail)
        vm.expectRevert("Respawn time not reached");
        world.hyperscape__respawnMob(mobId);
    }
    
    function testCanRespawnAfterTime() public {
        bytes32 mobId = world.hyperscape__spawnMob(0, 100, 10, 100, 1);
        
        // Kill mob through combat
        address attacker = address(0x123);
        vm.prank(attacker);
        world.hyperscape__register("Attacker");
        
        vm.startPrank(attacker);
        for (uint256 i = 0; i < 100; i++) {
            MobData memory mobState = Mob.get(mobId);
            if (!mobState.isAlive) break;
            world.hyperscape__attackMob(mobId);
        }
        vm.stopPrank();
        
        // Fast forward time
        vm.warp(block.timestamp + 901); // 15 minutes + 1 second
        
        bool respawned = world.hyperscape__respawnMob(mobId);
        assertTrue(respawned, "Should respawn");
        
        MobData memory mob = Mob.get(mobId);
        assertTrue(mob.isAlive, "Mob should be alive");
        assertEq(mob.health, 25, "Health should be restored");
    }
    
    function testCanRespawn() public {
        bytes32 mobId = world.hyperscape__spawnMob(0, 100, 10, 100, 1);
        
        bool canRespawn = world.hyperscape__canRespawn(mobId);
        assertFalse(canRespawn, "Living mob cannot respawn");
        
        // Kill mob through combat
        address attacker = address(0x123);
        vm.prank(attacker);
        world.hyperscape__register("Attacker");
        
        vm.startPrank(attacker);
        for (uint256 i = 0; i < 100; i++) {
            MobData memory mobState = Mob.get(mobId);
            if (!mobState.isAlive) break;
            world.hyperscape__attackMob(mobId);
        }
        vm.stopPrank();
        
        canRespawn = world.hyperscape__canRespawn(mobId);
        assertFalse(canRespawn, "Cannot respawn yet");
        
        // Fast forward time
        vm.warp(block.timestamp + 901);
        
        canRespawn = world.hyperscape__canRespawn(mobId);
        assertTrue(canRespawn, "Should be able to respawn now");
    }
    
    function testUniqueMobIds() public {
        bytes32 mob1 = world.hyperscape__spawnMob(0, 100, 10, 100, 1);
        bytes32 mob2 = world.hyperscape__spawnMob(0, 100, 10, 100, 2);
        bytes32 mob3 = world.hyperscape__spawnMob(0, 200, 10, 200, 1);
        
        assertTrue(mob1 != mob2, "Different spawn indices create unique IDs");
        assertTrue(mob1 != mob3, "Different positions create unique IDs");
        assertTrue(mob2 != mob3, "All IDs should be unique");
    }
    
    function testMobStats() public {
        bytes32 mobId = world.hyperscape__spawnMob(6, 100, 10, 100, 1); // Black Knight
        
        MobData memory mob = Mob.get(mobId);
        assertEq(mob.attackLevel, 25, "Black Knight attack level");
        assertEq(mob.strengthLevel, 26, "Black Knight strength level");
        assertEq(mob.defenseLevel, 22, "Black Knight defense level");
    }
    
    function testInvalidMobType() public {
        vm.expectRevert("Invalid mob type");
        world.hyperscape__spawnMob(9, 100, 10, 100, 1);
    }
}


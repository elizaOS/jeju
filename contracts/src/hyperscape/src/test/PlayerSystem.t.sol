// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { IWorld } from "../codegen/world/IWorld.sol";
import { Player, PlayerData, Position, PositionData, Health, HealthData, CombatSkills, Equipment, Coins } from "../codegen/index.sol";

contract PlayerSystemTest is MudTest {
    IWorld world;
    
    address player1 = address(0x1);
    address player2 = address(0x2);
    
    function setUp() public override {
        super.setUp();
        world = IWorld(worldAddress);
    }
    
    function testRegisterPlayer() public {
        vm.prank(player1);
        world.hyperscape__register("TestPlayer1");
        
        PlayerData memory playerData = Player.get(player1);
        assertTrue(playerData.exists, "Player should exist");
        assertEq(playerData.name, "TestPlayer1", "Name should match");
        assertGt(playerData.createdAt, 0, "Created timestamp should be set");
        
        PositionData memory pos = Position.get(player1);
        assertGt(pos.x, 0, "X should be > 0");
        assertEq(pos.y, 10, "Y should be 10");
        assertGt(pos.z, 0, "Z should be > 0");
        
        HealthData memory health = Health.get(player1);
        assertEq(health.current, 100, "Starting health should be 100");
        assertEq(health.max, 100, "Max health should be 100");
        
        assertEq(Coins.get(player1), 0, "Should start with 0 coins");
    }
    
    function testRegisterMultiplePlayers() public {
        vm.prank(player1);
        world.hyperscape__register("Player1");
        
        vm.prank(player2);
        world.hyperscape__register("Player2");
        
        assertTrue(Player.getExists(player1), "Player1 should exist");
        assertTrue(Player.getExists(player2), "Player2 should exist");
    }
    
    function testCannotRegisterTwice() public {
        vm.startPrank(player1);
        world.hyperscape__register("Player1");
        
        vm.expectRevert("Player already registered");
        world.hyperscape__register("Player1Again");
        vm.stopPrank();
    }
    
    function testMove() public {
        vm.prank(player1);
        world.hyperscape__register("Player1");
        
        vm.prank(player1);
        world.hyperscape__move(200, 20, 300);
        
        PositionData memory pos = Position.get(player1);
        assertEq(pos.x, 200, "X should update");
        assertEq(pos.y, 20, "Y should update");
        assertEq(pos.z, 300, "Z should update");
        assertEq(pos.chunkX, int16(int32(200) / 16), "ChunkX should update");
        assertEq(pos.chunkZ, int16(int32(300) / 16), "ChunkZ should update");
    }
    
    function testTakeDamage() public {
        vm.prank(player1);
        world.hyperscape__register("Player1");
        
        bool died = world.hyperscape__takeDamage(player1, 30);
        assertFalse(died, "Should not die from 30 damage");
        
        HealthData memory health = Health.get(player1);
        assertEq(health.current, 70, "Health should be 70");
    }
    
    function testTakeFatalDamage() public {
        vm.prank(player1);
        world.hyperscape__register("Player1");
        
        bool died = world.hyperscape__takeDamage(player1, 200);
        assertTrue(died, "Should die from 200 damage");
        
        HealthData memory health = Health.get(player1);
        assertEq(health.current, health.max, "Health should be restored to max");
        
        PositionData memory afterPos = Position.get(player1);
        assertEq(afterPos.y, 10, "Should respawn at y=10");
    }
    
    function testHeal() public {
        vm.prank(player1);
        world.hyperscape__register("Player1");
        
        world.hyperscape__takeDamage(player1, 50);
        world.hyperscape__heal(player1, 30);
        
        HealthData memory health = Health.get(player1);
        assertEq(health.current, 80, "Health should be 80");
    }
    
    function testHealCannotExceedMax() public {
        vm.prank(player1);
        world.hyperscape__register("Player1");
        
        world.hyperscape__heal(player1, 50);
        
        HealthData memory health = Health.get(player1);
        assertEq(health.current, 100, "Health should be capped at max");
    }
    
    function testUpdateMaxHealth() public {
        vm.prank(player1);
        world.hyperscape__register("Player1");
        
        world.hyperscape__updateMaxHealth(player1, 20);
        
        HealthData memory health = Health.get(player1);
        assertEq(health.max, 200, "Max health should be 200 (20 * 10)");
        assertEq(health.current, 100, "Current health should remain 100");
    }
    
    function testGetPosition() public {
        vm.prank(player1);
        world.hyperscape__register("Player1");
        
        vm.prank(player1);
        world.hyperscape__move(500, 50, 600);
        
        (int32 x, int32 y, int32 z) = world.hyperscape__getPosition(player1);
        assertEq(x, 500, "X should be 500");
        assertEq(y, 50, "Y should be 50");
        assertEq(z, 600, "Z should be 600");
    }
    
    function testIsAlive() public {
        vm.prank(player1);
        world.hyperscape__register("Player1");
        
        assertTrue(world.hyperscape__isAlive(player1), "Player should be alive");
        
        world.hyperscape__takeDamage(player1, 200);
        assertTrue(world.hyperscape__isAlive(player1), "Player should be alive after respawn");
    }
}


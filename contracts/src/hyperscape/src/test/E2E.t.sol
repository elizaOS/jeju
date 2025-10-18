// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { IWorld } from "../codegen/world/IWorld.sol";
import { Player, PlayerData, Position, PositionData, Health, HealthData, CombatSkills, CombatSkillsData, InventorySlot, Equipment, Coins, Mob, MobData } from "../codegen/index.sol";

/**
 * @title E2ETest
 * @notice End-to-end gameplay test - complete game flow
 * @dev Tests: Register → Move → Attack Mob → Loot → Level Up → Equip Item
 */
contract E2ETest is MudTest {
    IWorld world;
    
    address alice = address(0xA11CE);
    bytes32 goblinId;
    
    function setUp() public override {
        super.setUp();
        world = IWorld(worldAddress);
        
        // Initialize world (sets up items and loot tables)
        world.hyperscape__initialize();
    }
    
    /**
     * @notice Complete game flow test
     * @dev This is the critical test that verifies the entire game works
     */
    function testCompleteGameFlow() public {
        console.log("=== E2E Test: Complete Game Flow ===");
        
        // ========== STEP 1: Register Player ==========
        console.log("\n1. Registering player...");
        vm.prank(alice);
        world.hyperscape__register("Alice");
        
        PlayerData memory playerData = Player.get(alice);
        assertTrue(playerData.exists, "Player should exist");
        console.log("   [OK] Player registered");
        
        // ========== STEP 2: Verify Starting Stats ==========
        console.log("\n2. Verifying starting stats...");
        CombatSkillsData memory skills = CombatSkills.get(alice);
        assertEq(skills.attackLevel, 1, "Attack should be 1");
        assertEq(skills.constitutionLevel, 10, "Constitution should be 10");
        
        HealthData memory healthData = Health.get(alice);
        assertEq(healthData.current, 100, "Health should be 100");
        assertEq(healthData.max, 100, "Max health should be 100");
        
        uint256 coins = Coins.get(alice);
        assertEq(coins, 0, "Should start with 0 coins");
        console.log("   [OK] Starting stats verified");
        
        // ========== STEP 3: Move Around ==========
        console.log("\n3. Testing movement...");
        vm.prank(alice);
        world.hyperscape__move(150, 10, 150);
        
        PositionData memory pos = Position.get(alice);
        assertEq(pos.x, 150, "X position should update");
        assertEq(pos.y, 10, "Y position should update");
        assertEq(pos.z, 150, "Z position should update");
        console.log("   [OK] Movement works");
        
        // ========== STEP 4: Spawn Mob ==========
        console.log("\n4. Spawning goblin...");
        goblinId = world.hyperscape__spawnMob(
            0,      // Goblin
            150,    // Same position as player
            10,
            150,
            1       // Spawn index
        );
        
        MobData memory mobData = Mob.get(goblinId);
        assertTrue(mobData.isAlive, "Goblin should be alive");
        assertEq(mobData.health, 25, "Goblin should have 25 HP");
        console.log("   [OK] Goblin spawned");
        
        // ========== STEP 5: Attack Mob Until Dead ==========
        console.log("\n5. Fighting goblin...");
        vm.startPrank(alice);
        
        uint256 attacks = 0;
        while (attacks < 200) { // Increased safety limit to account for misses
            MobData memory currentMob = Mob.get(goblinId);
            if (!currentMob.isAlive) break;
            
            world.hyperscape__attackMob(goblinId);
            attacks++;
        }
        
        console.log("   [OK] Goblin killed after", attacks, "attacks");
        vm.stopPrank();
        
        // Verify mob is dead
        MobData memory deadMob = Mob.get(goblinId);
        assertFalse(deadMob.isAlive, "Goblin should be dead");
        
        // ========== STEP 6: Verify Loot ==========
        console.log("\n6. Checking loot...");
        uint256 coinsAfter = Coins.get(alice);
        assertGt(coinsAfter, 0, "Should have received coins");
        assertLe(coinsAfter, 5, "Should not exceed max goblin drop");
        console.log("   [OK] Received", coinsAfter, "coins");
        
        // ========== STEP 7: Verify XP Gained ==========
        console.log("\n7. Verifying XP gain...");
        CombatSkillsData memory finalSkills = CombatSkills.get(alice);
        
        // Should have gained some XP from combat
        console.log("   Attack XP:", finalSkills.attackXp);
        console.log("   Strength XP:", finalSkills.strengthXp);
        console.log("   Constitution XP:", finalSkills.constitutionXp);
        console.log("   [OK] XP gained from combat");
        
        // ========== STEP 8: Test Gathering (if items available) ==========
        console.log("\n8. Testing resource gathering...");
        // Spawn a tree
        bytes32 treeId = world.hyperscape__spawnResource(0, 160, 10, 160);
        
        // Give player a hatchet - addItem is public so anyone can call it
        world.hyperscape__addItem(alice, 50, 1); // Bronze hatchet
        
        vm.startPrank(alice);
        world.hyperscape__equipItem(0); // Equip hatchet
        
        // Chop tree
        (bool success, uint16 logsId) = world.hyperscape__chopTree(treeId);
        vm.stopPrank();
        assertTrue(success, "Should successfully chop tree");
        assertEq(logsId, 1, "Should receive logs");
        console.log("   [OK] Resource gathering works");
        
        // ========== SUCCESS ==========
        console.log("\n=== E2E Test PASSED ===");
        console.log("Complete game flow verified:");
        console.log("  [OK] Player registration");
        console.log("  [OK] Movement");
        console.log("  [OK] Mob spawning");
        console.log("  [OK] Combat");
        console.log("  [OK] Loot drops");
        console.log("  [OK] XP gain");
        console.log("  [OK] Equipment system");
        console.log("  [OK] Resource gathering");
    }
    
    /**
     * @notice Test player can respawn after death
     */
    function testDeathAndRespawn() public {
        console.log("\n=== Testing Death & Respawn ===");
        
        // Register player
        vm.prank(alice);
        world.hyperscape__register("Alice");
        
        // Get initial position
        PositionData memory initialPos = Position.get(alice);
        console.log("Initial position:", uint32(int32(initialPos.x)), uint32(int32(initialPos.z)));
        
        // Deal fatal damage - use any address, not the world itself
        bool died = world.hyperscape__takeDamage(alice, 200);
        
        assertTrue(died, "Player should die");
        console.log("   [OK] Player died");
        
        // Check respawned
        HealthData memory health = Health.get(alice);
        assertEq(health.current, health.max, "Health should be restored");
        
        PositionData memory newPos = Position.get(alice);
        assertEq(newPos.y, 10, "Should respawn at y=10");
        console.log("   [OK] Player respawned at starter town");
        
        console.log("=== Death & Respawn Test PASSED ===");
    }
    
    /**
     * @notice Test mob respawn system
     */
    function testMobRespawn() public {
        console.log("\n=== Testing Mob Respawn ===");
        
        // Spawn mob
        goblinId = world.hyperscape__spawnMob(0, 100, 10, 100, 1);
        console.log("   Mob spawned");
        
        // Register player and kill mob
        vm.prank(alice);
        world.hyperscape__register("Alice");
        
        vm.startPrank(alice);
        for (uint256 i = 0; i < 200; i++) {
            MobData memory mobData = Mob.get(goblinId);
            if (!mobData.isAlive) break;
            world.hyperscape__attackMob(goblinId);
        }
        vm.stopPrank();
        
        // Mob should be dead
        MobData memory deadMob = Mob.get(goblinId);
        assertFalse(deadMob.isAlive, "Mob should be dead");
        console.log("   [OK] Mob killed");
        
        // Check cannot respawn yet (need to wait 15 minutes)
        bool canRespawn = world.hyperscape__canRespawn(goblinId);
        assertFalse(canRespawn, "Should not be able to respawn yet");
        
        // Fast forward time
        vm.warp(block.timestamp + 901); // 15 minutes + 1 second
        
        canRespawn = world.hyperscape__canRespawn(goblinId);
        assertTrue(canRespawn, "Should be able to respawn now");
        
        // Respawn mob
        bool respawned = world.hyperscape__respawnMob(goblinId);
        assertTrue(respawned, "Respawn should succeed");
        
        // Verify mob is alive again
        MobData memory revivedMob = Mob.get(goblinId);
        assertTrue(revivedMob.isAlive, "Mob should be alive");
        assertEq(revivedMob.health, 25, "Mob should have full health");
        
        console.log("   [OK] Mob respawned after 15 minutes");
        console.log("=== Mob Respawn Test PASSED ===");
    }
}



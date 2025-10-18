// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { IWorld } from "../codegen/world/IWorld.sol";
import { Player, Mob, MobData, CombatSkills, CombatSkillsData, Coins, Equipment } from "../codegen/index.sol";

contract CombatSystemTest is MudTest {
    IWorld world;
    
    address alice = address(0xA11CE);
    bytes32 goblinId;
    
    function setUp() public override {
        super.setUp();
        world = IWorld(worldAddress);
        world.hyperscape__initialize();
        
        vm.prank(alice);
        world.hyperscape__register("Alice");
        
        goblinId = world.hyperscape__spawnMob(0, 100, 10, 100, 1);
    }
    
    function testAttackMob() public {
        uint32 initialHealth = Mob.getHealth(goblinId);
        
        // Attack multiple times to ensure at least one hit lands
        vm.startPrank(alice);
        for (uint256 i = 0; i < 10; i++) {
            world.hyperscape__attackMob(goblinId);
            uint32 currentHealth = Mob.getHealth(goblinId);
            if (currentHealth < initialHealth) {
                // Damage was dealt
                vm.stopPrank();
                assertLt(currentHealth, initialHealth, "Mob should have taken damage");
                return;
            }
        }
        vm.stopPrank();
        
        // If we get here, no damage was dealt in 10 attacks (very unlikely with 50%+ hit chance)
        fail("Mob should have taken damage after 10 attacks");
    }
    
    function testKillMob() public {
        vm.startPrank(alice);
        
        // Attack until dead (more attempts to account for misses)
        for (uint256 i = 0; i < 200; i++) {
            MobData memory currentMob = Mob.get(goblinId);
            if (!currentMob.isAlive) break;
            world.hyperscape__attackMob(goblinId);
        }
        vm.stopPrank();
        
        MobData memory mob = Mob.get(goblinId);
        assertFalse(mob.isAlive, "Mob should be dead");
        assertEq(mob.health, 0, "Mob health should be 0");
    }
    
    function testLootDrops() public {
        uint256 coinsBefore = Coins.get(alice);
        
        vm.startPrank(alice);
        for (uint256 i = 0; i < 200; i++) {
            MobData memory currentMob = Mob.get(goblinId);
            if (!currentMob.isAlive) break;
            world.hyperscape__attackMob(goblinId);
        }
        vm.stopPrank();
        
        uint256 coinsAfter = Coins.get(alice);
        assertGt(coinsAfter, coinsBefore, "Should have received coins");
        assertLe(coinsAfter - coinsBefore, 5, "Should not exceed max goblin drop");
    }
    
    function testXPGain() public {
        CombatSkillsData memory skillsBefore = CombatSkills.get(alice);
        
        vm.startPrank(alice);
        for (uint256 i = 0; i < 5; i++) {
            world.hyperscape__attackMob(goblinId);
        }
        vm.stopPrank();
        
        CombatSkillsData memory skillsAfter = CombatSkills.get(alice);
        assertGt(skillsAfter.attackXp, skillsBefore.attackXp, "Should gain attack XP");
        assertGt(skillsAfter.strengthXp, skillsBefore.strengthXp, "Should gain strength XP");
        assertGt(skillsAfter.defenseXp, skillsBefore.defenseXp, "Should gain defense XP");
        assertGt(skillsAfter.constitutionXp, skillsBefore.constitutionXp, "Should gain constitution XP");
    }
    
    function testCannotAttackDeadMob() public {
        vm.startPrank(alice);
        // Attack until mob is definitely dead (more attacks to account for misses)
        for (uint256 i = 0; i < 200; i++) {
            MobData memory currentMob = Mob.get(goblinId);
            if (!currentMob.isAlive) break;
            world.hyperscape__attackMob(goblinId);
        }
        
        // Verify mob is dead
        MobData memory deadMob = Mob.get(goblinId);
        assertTrue(!deadMob.isAlive, "Mob should be dead after 200 attacks");
        
        // Now attacking should revert
        vm.expectRevert("Mob is dead");
        world.hyperscape__attackMob(goblinId);
        vm.stopPrank();
    }
    
    function testRangedAttack() public {
        // Give player a bow and arrows
        world.hyperscape__addItem(alice, 150, 1); // Wood Bow (slot 0)
        world.hyperscape__addItem(alice, 60, 100); // Arrows (slot 1)
        
        uint32 initialHealth = Mob.getHealth(goblinId);
        
        vm.startPrank(alice);
        world.hyperscape__equipItem(0); // Equip bow from slot 0
        world.hyperscape__equipItem(1); // Equip arrows from slot 1 (arrows are still in slot 1)
        
        // Attack multiple times to ensure at least one hit lands (ranged attacks can miss)
        for (uint256 i = 0; i < 20; i++) {
            world.hyperscape__attackMob(goblinId);
            uint32 currentHealth = Mob.getHealth(goblinId);
            if (currentHealth < initialHealth) {
                vm.stopPrank();
                assertLt(currentHealth, initialHealth, "Mob should have taken ranged damage");
                return;
            }
        }
        vm.stopPrank();
        fail("Mob should have taken ranged damage after 20 attacks");
    }
    
    function testMeleeWithWeapon() public {
        // Give player a sword
        world.hyperscape__addItem(alice, 100, 1); // Bronze Sword
        
        vm.startPrank(alice);
        world.hyperscape__equipItem(0); // Equip sword
        
        uint32 healthBefore = Mob.getHealth(goblinId);
        
        // Attack multiple times to ensure at least one hit lands
        for (uint256 i = 0; i < 20; i++) {
            world.hyperscape__attackMob(goblinId);
            uint32 currentHealth = Mob.getHealth(goblinId);
            if (currentHealth < healthBefore) {
                vm.stopPrank();
                assertLt(currentHealth, healthBefore, "Mob should take damage with weapon");
                return;
            }
        }
        
        vm.stopPrank();
        fail("Mob should take damage with weapon after 20 attacks");
    }
    
    function testDifferentMobTypes() public {
        bytes32 banditId = world.hyperscape__spawnMob(1, 200, 10, 200, 2);
        bytes32 barbarianId = world.hyperscape__spawnMob(2, 300, 10, 300, 3);
        
        MobData memory bandit = Mob.get(banditId);
        MobData memory barbarian = Mob.get(barbarianId);
        
        assertEq(bandit.health, 28, "Bandit should have 28 HP");
        assertEq(barbarian.health, 30, "Barbarian should have 30 HP");
    }
}


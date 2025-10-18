// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { MudTest } from "@latticexyz/world/test/MudTest.t.sol";
import { IWorld } from "../codegen/world/IWorld.sol";
import { Player, CombatSkills, CombatSkillsData, GatheringSkills, GatheringSkillsData, Health, HealthData } from "../codegen/index.sol";

contract SkillSystemTest is MudTest {
    IWorld world;
    
    address player1 = address(0x1);
    
    function setUp() public override {
        super.setUp();
        world = IWorld(worldAddress);
        
        vm.prank(player1);
        world.hyperscape__register("Player1");
    }
    
    function testGrantAttackXP() public {
        world.hyperscape__grantAttackXP(player1, 100);
        
        CombatSkillsData memory skills = CombatSkills.get(player1);
        assertEq(skills.attackXp, 100, "Should have 100 attack XP");
    }
    
    function testGrantStrengthXP() public {
        world.hyperscape__grantStrengthXP(player1, 150);
        
        CombatSkillsData memory skills = CombatSkills.get(player1);
        assertEq(skills.strengthXp, 150, "Should have 150 strength XP");
    }
    
    function testGrantDefenseXP() public {
        world.hyperscape__grantDefenseXP(player1, 200);
        
        CombatSkillsData memory skills = CombatSkills.get(player1);
        assertEq(skills.defenseXp, 200, "Should have 200 defense XP");
    }
    
    function testGrantConstitutionXP() public {
        world.hyperscape__grantConstitutionXP(player1, 1154);
        
        CombatSkillsData memory skills = CombatSkills.get(player1);
        assertGt(skills.constitutionXp, 1154, "Should have gained constitution XP");
    }
    
    function testConstitutionLevelUpIncreasesMaxHealth() public {
        HealthData memory healthBefore = Health.get(player1);
        uint32 maxHealthBefore = healthBefore.max;
        
        // Grant enough XP to level up (level 11 needs more XP)
        world.hyperscape__grantConstitutionXP(player1, 3000);
        
        HealthData memory healthAfter = Health.get(player1);
        assertGt(healthAfter.max, maxHealthBefore, "Max health should increase");
    }
    
    function testGrantRangedXP() public {
        world.hyperscape__grantRangedXP(player1, 250);
        
        CombatSkillsData memory skills = CombatSkills.get(player1);
        assertEq(skills.rangedXp, 250, "Should have 250 ranged XP");
    }
    
    function testGrantWoodcuttingXP() public {
        world.hyperscape__grantWoodcuttingXP(player1, 100);
        
        GatheringSkillsData memory skills = GatheringSkills.get(player1);
        assertEq(skills.woodcuttingXp, 100, "Should have 100 woodcutting XP");
    }
    
    function testGrantFishingXP() public {
        world.hyperscape__grantFishingXP(player1, 50);
        
        GatheringSkillsData memory skills = GatheringSkills.get(player1);
        assertEq(skills.fishingXp, 50, "Should have 50 fishing XP");
    }
    
    function testGrantFiremakingXP() public {
        world.hyperscape__grantFiremakingXP(player1, 150);
        
        GatheringSkillsData memory skills = GatheringSkills.get(player1);
        assertEq(skills.firemakingXp, 150, "Should have 150 firemaking XP");
    }
    
    function testGrantCookingXP() public {
        world.hyperscape__grantCookingXP(player1, 120);
        
        GatheringSkillsData memory skills = GatheringSkills.get(player1);
        assertEq(skills.cookingXp, 120, "Should have 120 cooking XP");
    }
    
    function testLevelUp() public {
        // Grant enough XP to level up from 1 to 2 (needs 83 XP)
        world.hyperscape__grantAttackXP(player1, 100);
        
        CombatSkillsData memory skills = CombatSkills.get(player1);
        assertGt(skills.attackLevel, 1, "Should level up");
    }
    
    function testMultipleLevelUps() public {
        // Grant a lot of XP
        world.hyperscape__grantAttackXP(player1, 10000);
        
        CombatSkillsData memory skills = CombatSkills.get(player1);
        assertGt(skills.attackLevel, 5, "Should level up multiple times");
    }
    
    function testAllCombatSkills() public {
        world.hyperscape__grantAttackXP(player1, 500);
        world.hyperscape__grantStrengthXP(player1, 600);
        world.hyperscape__grantDefenseXP(player1, 700);
        world.hyperscape__grantConstitutionXP(player1, 800);
        world.hyperscape__grantRangedXP(player1, 900);
        
        CombatSkillsData memory skills = CombatSkills.get(player1);
        assertGt(skills.attackXp, 0, "Attack XP should be set");
        assertGt(skills.strengthXp, 0, "Strength XP should be set");
        assertGt(skills.defenseXp, 0, "Defense XP should be set");
        assertGt(skills.constitutionXp, 1154, "Constitution XP should increase");
        assertGt(skills.rangedXp, 0, "Ranged XP should be set");
    }
    
    function testAllGatheringSkills() public {
        world.hyperscape__grantWoodcuttingXP(player1, 100);
        world.hyperscape__grantFishingXP(player1, 200);
        world.hyperscape__grantFiremakingXP(player1, 300);
        world.hyperscape__grantCookingXP(player1, 400);
        
        GatheringSkillsData memory skills = GatheringSkills.get(player1);
        assertEq(skills.woodcuttingXp, 100, "Woodcutting XP");
        assertEq(skills.fishingXp, 200, "Fishing XP");
        assertEq(skills.firemakingXp, 300, "Firemaking XP");
        assertEq(skills.cookingXp, 400, "Cooking XP");
    }
    
    function testXPAccumulation() public {
        world.hyperscape__grantAttackXP(player1, 50);
        world.hyperscape__grantAttackXP(player1, 50);
        world.hyperscape__grantAttackXP(player1, 100);
        
        CombatSkillsData memory skills = CombatSkills.get(player1);
        assertEq(skills.attackXp, 200, "XP should accumulate");
    }
}


// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {elizaOSToken} from "../src/token/elizaOSToken.sol";
import {LiquidityVault} from "../src/liquidity/LiquidityVault.sol";
import {FeeDistributor} from "../src/distributor/FeeDistributor.sol";
import {LiquidityPaymaster} from "../src/paymaster/LiquidityPaymaster.sol";
import {ManualPriceOracle} from "../src/oracle/ManualPriceOracle.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {IdentityRegistry} from "../src/registry/IdentityRegistry.sol";
import {ReputationRegistry} from "../src/registry/ReputationRegistry.sol";
import {ValidationRegistry} from "../src/registry/ValidationRegistry.sol";
import {SimpleGame} from "../src/examples/SimpleGame.sol";

/**
 * @title CompleteSystemIntegrationTest
 * @notice End-to-end test of paymaster + registry integration
 */
contract CompleteSystemIntegrationTest is Test {
    // Paymaster system
    elizaOSToken public eliza;
    LiquidityVault public vault;
    FeeDistributor public distributor;
    LiquidityPaymaster public paymaster;
    ManualPriceOracle public oracle;
    MockEntryPoint public entryPoint;
    
    // Registry system
    IdentityRegistry public identityRegistry;
    ReputationRegistry public reputationRegistry;
    ValidationRegistry public validationRegistry;
    
    // Example app
    SimpleGame public game;
    
    // Actors
    address public owner = address(this);
    address public lp = address(0x1);
    address public agentOwner = address(0x2);
    address public user = address(0x3);
    address public validator = address(0x4);
    
    uint256 public agentId;
    address public revenueWallet = address(0xA);
    
    function setUp() public {
        // Deploy paymaster system
        eliza = new elizaOSToken(owner);
        oracle = new ManualPriceOracle(300000000000, 10000000, owner); // $3000 ETH, $0.10 eliza
        vault = new LiquidityVault(address(eliza), owner);
        distributor = new FeeDistributor(address(eliza), address(vault), owner);
        entryPoint = new MockEntryPoint();
        paymaster = new LiquidityPaymaster(
            IEntryPoint(address(entryPoint)),
            address(eliza),
            address(vault),
            address(distributor),
            address(oracle)
        );
        
        // Configure paymaster
        vault.setPaymaster(address(paymaster));
        vault.setFeeDistributor(address(distributor));
        distributor.setPaymaster(address(paymaster));
        
        // Deploy registry system
        identityRegistry = new IdentityRegistry();
        reputationRegistry = new ReputationRegistry(address(identityRegistry));
        validationRegistry = new ValidationRegistry(address(identityRegistry));
        
        // Fund accounts
        vm.deal(lp, 100 ether);
        vm.deal(user, 10 ether);
        eliza.transfer(lp, 1000000e18);
        eliza.transfer(user, 10000e18);
        eliza.transfer(agentOwner, 10000e18);
    }
    
    function testCompleteAgentEcosystem() public {
        // ======== PHASE 1: Setup Liquidity ========
        vm.startPrank(lp);
        vault.addETHLiquidity{value: 20 ether}();
        eliza.approve(address(vault), 100000e18);
        vault.addElizaLiquidity(100000e18);
        vm.stopPrank();
        
        // ======== PHASE 2: Register Agent ========
        vm.startPrank(agentOwner);
        agentId = identityRegistry.register("ipfs://my-trading-bot");
        
        // Set agent metadata
        identityRegistry.setMetadata(agentId, "name", abi.encode("DeFi Trading Bot"));
        identityRegistry.setMetadata(agentId, "type", abi.encode("trading"));
        identityRegistry.setMetadata(agentId, "model", abi.encode("GPT-4"));
        identityRegistry.setMetadata(agentId, "revenueWallet", abi.encode(revenueWallet));
        
        vm.stopPrank();
        
        // Verify agent registered
        assertEq(identityRegistry.totalAgents(), 1);
        assertEq(identityRegistry.ownerOf(agentId), agentOwner);
        string memory agentName = abi.decode(identityRegistry.getMetadata(agentId, "name"), (string));
        assertEq(agentName, "DeFi Trading Bot");
        
        // ======== PHASE 3: Deploy Agent's App ========
        game = new SimpleGame(revenueWallet);
        assertEq(game.revenueWallet(), revenueWallet);
        
        // ======== PHASE 4: Simulate User Transaction (Earning Revenue) ========
        // Fund paymaster
        vault.setPaymaster(owner);
        vm.startPrank(owner);
        vault.provideETHForGas(5 ether);
        entryPoint.depositTo{value: 5 ether}(address(paymaster));
        vm.stopPrank();
        vault.setPaymaster(address(paymaster));
        
        // User approves elizaOS
        vm.prank(user);
        eliza.approve(address(paymaster), type(uint256).max);
        
        // Simulate fee collection (simplified)
        uint256 fees = 100e18;
        vm.startPrank(user);
        eliza.transfer(address(paymaster), fees);
        vm.stopPrank();
        
        vm.startPrank(address(paymaster));
        eliza.approve(address(distributor), fees);
        distributor.distributeFees(fees, revenueWallet);
        vm.stopPrank();
        
        // Agent earned 50% of fees
        uint256 agentEarnings = distributor.appEarnings(revenueWallet);
        assertEq(agentEarnings, 50e18); // 50% of 100
        
        // ======== PHASE 5: Request Validation ========
        vm.startPrank(agentOwner);
        validationRegistry.validationRequest(
            validator,
            agentId,
            "ipfs://code-for-validation",
            keccak256("validation-request-data")
        );
        vm.stopPrank();
        
        bytes32[] memory validations = validationRegistry.getAgentValidations(agentId);
        assertEq(validations.length, 1);
        
        // Validator provides response
        bytes32 requestHash = validations[0];
        vm.prank(validator);
        validationRegistry.validationResponse(
            requestHash,
            100, // Fully validated
            "ipfs://validation-result",
            keccak256("validation-result-data"),
            bytes32("tee-verified")
        );
        
        // Check validation status
        (
            address validatorAddr,
            uint256 validatedAgentId,
            uint8 validationScore,
            bytes32 tag,
            uint256 lastUpdate
        ) = validationRegistry.getValidationStatus(requestHash);
        
        assertEq(validatorAddr, validator);
        assertEq(validatedAgentId, agentId);
        assertEq(validationScore, 100);
        assertEq(tag, bytes32("tee-verified"));
        assertGt(lastUpdate, 0);
        
        // ======== PHASE 6: Agent Claims Revenue ========
        uint256 balanceBefore = eliza.balanceOf(revenueWallet);
        vm.prank(revenueWallet);
        distributor.claimEarnings();
        
        uint256 balanceAfter = eliza.balanceOf(revenueWallet);
        assertEq(balanceAfter - balanceBefore, 50e18);
        
        // ======== PHASE 7: Verify Complete System ========
        
        // Agent exists and has metadata
        assertTrue(identityRegistry.agentExists(agentId));
        
        // Agent has validation
        assertEq(validationRegistry.getAgentValidations(agentId).length, 1);
        
        // Agent earned revenue
        assertEq(distributor.appEarnings(revenueWallet), 0); // Claimed
        assertEq(eliza.balanceOf(revenueWallet), 50e18);
        
        // LPs earned fees
        assertGt(vault.pendingFees(lp), 0);
        
        console.log("==========================================");
        console.log("COMPLETE SYSTEM TEST PASSED!");
        console.log("==========================================");
        console.log("Agent ID:", agentId);
        console.log("Agent Name:", agentName);
        console.log("Validation Score:", validationScore);
        console.log("Revenue Earned:", balanceAfter / 1e18, "elizaOS");
        console.log("LP Fees Pending:", vault.pendingFees(lp) / 1e18, "elizaOS");
        console.log("==========================================");
    }
}

/**
 * @title MockEntryPoint
 * @notice Mock EntryPoint for testing
 */
contract MockEntryPoint {
    mapping(address => uint256) public balances;
    
    function depositTo(address account) external payable {
        balances[account] += msg.value;
    }
    
    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }
    
    function withdrawTo(address payable dest, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool success,) = dest.call{value: amount}("");
        require(success, "Transfer failed");
    }
    
    function addStake(uint32) external payable {}
    function unlockStake() external {}
    function withdrawStake(address payable) external {}
    function supportsInterface(bytes4) external pure returns (bool) { return true; }
    
    receive() external payable {}
}


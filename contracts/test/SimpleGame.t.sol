// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {SimpleGame} from "../src/examples/SimpleGame.sol";

/**
 * @title SimpleGame Test Suite
 * @notice Comprehensive tests for the SimpleGame example contract
 * @dev Tests revenue wallet mechanics, score tracking, and paymaster integration patterns
 */
contract SimpleGameTest is Test {
    SimpleGame public game;
    
    address public revenueWallet = address(0x1);
    address public player1 = address(0x2);
    address public player2 = address(0x3);
    
    event PlayerMoved(address indexed player, uint256 newScore);
    event RevenueWalletUpdated(address indexed newWallet);
    
    function setUp() public {
        game = new SimpleGame(revenueWallet);
    }
    
    // ============ Constructor Tests ============
    
    function testConstructor_SetsRevenueWallet() public view {
        assertEq(game.revenueWallet(), revenueWallet);
    }
    
    function testConstructor_RevertsOnZeroAddress() public {
        vm.expectRevert("Invalid wallet");
        new SimpleGame(address(0));
    }
    
    // ============ Game Functionality Tests ============
    
    function testMakeMove_IncrementsScore() public {
        vm.prank(player1);
        game.makeMove();
        
        assertEq(game.getScore(player1), 1);
    }
    
    function testMakeMove_IncrementsTotalPlays() public {
        uint256 initialPlays = game.totalPlays();
        
        vm.prank(player1);
        game.makeMove();
        
        assertEq(game.totalPlays(), initialPlays + 1);
    }
    
    function testMakeMove_EmitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit PlayerMoved(player1, 1);
        
        vm.prank(player1);
        game.makeMove();
    }
    
    function testMakeMove_MultipleTimesIncrementsScore() public {
        vm.startPrank(player1);
        game.makeMove();
        game.makeMove();
        game.makeMove();
        vm.stopPrank();
        
        assertEq(game.getScore(player1), 3);
        assertEq(game.totalPlays(), 3);
    }
    
    function testMakeMove_DifferentPlayersHaveSeparateScores() public {
        vm.prank(player1);
        game.makeMove();
        
        vm.startPrank(player2);
        game.makeMove();
        game.makeMove();
        vm.stopPrank();
        
        assertEq(game.getScore(player1), 1);
        assertEq(game.getScore(player2), 2);
        assertEq(game.totalPlays(), 3);
    }
    
    // ============ Reset Score Tests ============
    
    function testResetScore_ResetsToZero() public {
        vm.startPrank(player1);
        game.makeMove();
        game.makeMove();
        assertEq(game.getScore(player1), 2);
        
        game.resetScore();
        assertEq(game.getScore(player1), 0);
        vm.stopPrank();
    }
    
    function testResetScore_OnlyAffectsCallerScore() public {
        vm.prank(player1);
        game.makeMove();
        
        vm.prank(player2);
        game.makeMove();
        
        vm.prank(player1);
        game.resetScore();
        
        assertEq(game.getScore(player1), 0);
        assertEq(game.getScore(player2), 1); // Unchanged
    }
    
    // ============ Revenue Wallet Tests ============
    
    function testSetRevenueWallet_UpdatesWallet() public {
        address newWallet = address(0x999);
        
        vm.prank(revenueWallet);
        game.setRevenueWallet(newWallet);
        
        assertEq(game.getRevenueWallet(), newWallet);
    }
    
    function testSetRevenueWallet_EmitsEvent() public {
        address newWallet = address(0x999);
        
        vm.expectEmit(true, false, false, false);
        emit RevenueWalletUpdated(newWallet);
        
        vm.prank(revenueWallet);
        game.setRevenueWallet(newWallet);
    }
    
    function testSetRevenueWallet_OnlyCurrentWalletCanChange() public {
        address newWallet = address(0x999);
        
        vm.prank(player1); // Not the revenue wallet
        vm.expectRevert("Only revenue wallet can change");
        game.setRevenueWallet(newWallet);
    }
    
    function testSetRevenueWallet_RevertsOnZeroAddress() public {
        vm.prank(revenueWallet);
        vm.expectRevert("Invalid wallet");
        game.setRevenueWallet(address(0));
    }
    
    function testSetRevenueWallet_NewWalletCanChangeAgain() public {
        address wallet2 = address(0x888);
        address wallet3 = address(0x777);
        
        // Original wallet sets wallet2
        vm.prank(revenueWallet);
        game.setRevenueWallet(wallet2);
        
        // Wallet2 can now change to wallet3
        vm.prank(wallet2);
        game.setRevenueWallet(wallet3);
        
        assertEq(game.getRevenueWallet(), wallet3);
    }
    
    // ============ View Function Tests ============
    
    function testGetScore_ReturnsCorrectScore() public {
        assertEq(game.getScore(player1), 0);
        
        vm.prank(player1);
        game.makeMove();
        
        assertEq(game.getScore(player1), 1);
    }
    
    function testGetRevenueWallet_ReturnsCorrectWallet() public view {
        assertEq(game.getRevenueWallet(), revenueWallet);
    }
    
    function testVersion() public view {
        assertEq(game.version(), "1.0.0");
    }
    
    // ============ Paymaster Integration Tests ============
    
    /**
     * @notice Test that demonstrates how paymaster integration works
     * @dev In production, the UserOp would include paymasterAndData with:
     *      - Bytes 0-19: Paymaster address
     *      - Bytes 20-35: verificationGasLimit
     *      - Bytes 36-51: postOpGasLimit
     *      - Bytes 52-71: revenueWallet (THIS contract's revenue wallet!)
     * 
     * The game contract itself doesn't need to know about paymasters.
     * Fee distribution happens automatically via the paymaster system.
     */
    function testPaymasterIntegration_ConceptualExample() public view {
        // In a real UserOp, user's wallet would construct paymasterAndData like:
        // paymasterAndData = abi.encodePacked(
        //     paymasterAddress,           // 20 bytes
        //     uint128(verificationGas),   // 16 bytes
        //     uint128(postOpGas),         // 16 bytes
        //     game.getRevenueWallet()     // 20 bytes - THIS IS THE KEY!
        // );
        
        // The game contract just needs to expose getRevenueWallet()
        // Everything else is handled by the paymaster + fee distributor
        
        address walletToIncludeInUserOp = game.getRevenueWallet();
        assertEq(walletToIncludeInUserOp, revenueWallet);
        
        // When user plays the game:
        // 1. User calls makeMove() via AA wallet
        // 2. UserOp includes revenueWallet in paymasterAndData
        // 3. Paymaster sponsors gas using ETH from liquidity vault
        // 4. Paymaster collects elizaOS from user
        // 5. FeeDistributor credits 50% to revenueWallet
        // 6. makeMove() executes normally (no special logic needed!)
        // 7. Revenue wallet can claim earnings from FeeDistributor
    }
    
    // ============ Gas Benchmarks ============
    
    function testGas_MakeMove() public {
        vm.prank(player1);
        uint256 gasBefore = gasleft();
        game.makeMove();
        uint256 gasUsed = gasBefore - gasleft();
        
        // Should be very cheap (just storage writes)
        // First call is ~51k gas (cold storage), subsequent calls cheaper
        assertLt(gasUsed, 60000);
        
        console.log("Gas used for makeMove():", gasUsed);
    }
    
    function testGas_ResetScore() public {
        vm.startPrank(player1);
        game.makeMove();
        
        uint256 gasBefore = gasleft();
        game.resetScore();
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();
        
        assertLt(gasUsed, 30000);
        
        console.log("Gas used for resetScore():", gasUsed);
    }
    
    // ============ Fuzz Tests ============
    
    function testFuzz_MakeMove(address player) public {
        vm.assume(player != address(0));
        
        vm.prank(player);
        game.makeMove();
        
        assertEq(game.getScore(player), 1);
    }
    
    function testFuzz_MultipleMovesIncrementScore(address player, uint8 moves) public {
        vm.assume(player != address(0));
        vm.assume(moves > 0);
        
        vm.startPrank(player);
        for (uint256 i = 0; i < moves; i++) {
            game.makeMove();
        }
        vm.stopPrank();
        
        assertEq(game.getScore(player), moves);
    }
    
    function testFuzz_RevenueWalletAddress(address wallet) public {
        vm.assume(wallet != address(0));
        
        SimpleGame newGame = new SimpleGame(wallet);
        assertEq(newGame.getRevenueWallet(), wallet);
    }
    
    // ============ Edge Cases ============
    
    function testEdge_VeryHighScore() public {
        vm.startPrank(player1);
        
        // Play 1000 times
        for (uint256 i = 0; i < 1000; i++) {
            game.makeMove();
        }
        
        vm.stopPrank();
        
        assertEq(game.getScore(player1), 1000);
        assertEq(game.totalPlays(), 1000);
    }
    
    function testEdge_ResetScoreTwice() public {
        vm.startPrank(player1);
        game.makeMove();
        game.resetScore();
        assertEq(game.getScore(player1), 0);
        
        game.resetScore(); // Reset already-zero score
        assertEq(game.getScore(player1), 0);
        vm.stopPrank();
    }
    
    function testEdge_GetScoreForNonPlayer() public view {
        address neverPlayed = address(0xdead);
        assertEq(game.getScore(neverPlayed), 0);
    }
}


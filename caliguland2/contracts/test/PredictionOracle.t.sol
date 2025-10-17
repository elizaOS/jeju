// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PredictionOracle.sol";

contract PredictionOracleTest is Test {
    PredictionOracle public oracle;
    address public gameServer;
    address public user1;
    address public user2;

    event GameCommitted(
        bytes32 indexed sessionId,
        string question,
        bytes32 commitment,
        uint256 startTime
    );

    event GameRevealed(
        bytes32 indexed sessionId,
        bool outcome,
        uint256 endTime,
        bytes teeQuote,
        uint256 winnersCount
    );

    function setUp() public {
        gameServer = address(this);
        user1 = address(0x1);
        user2 = address(0x2);
        
        oracle = new PredictionOracle(gameServer);
    }

    function testCommitGame() public {
        bytes32 sessionId = keccak256("game-1");
        string memory question = "Will ETH reach $5000?";
        bytes32 commitment = keccak256(abi.encodePacked(true, bytes32(uint256(123))));

        vm.expectEmit(true, false, false, true);
        emit GameCommitted(sessionId, question, commitment, block.timestamp);

        oracle.commitGame(sessionId, question, commitment);

        // Verify game was created
        (bool outcome, bool finalized) = oracle.getOutcome(sessionId);
        assertFalse(outcome);
        assertFalse(finalized);

        // Verify commitment is stored
        assertTrue(oracle.verifyCommitment(commitment));
    }

    function testCannotCommitSameGameTwice() public {
        bytes32 sessionId = keccak256("game-1");
        string memory question = "Test question";
        bytes32 commitment = keccak256(abi.encodePacked(true, bytes32(uint256(123))));

        oracle.commitGame(sessionId, question, commitment);

        // Try to commit same session again
        vm.expectRevert("Session already exists");
        oracle.commitGame(sessionId, "Different question", keccak256("different"));
    }

    function testRevealGame() public {
        // Setup: commit a game
        bytes32 sessionId = keccak256("game-1");
        string memory question = "Will ETH reach $5000?";
        bool expectedOutcome = true;
        bytes32 salt = bytes32(uint256(123));
        bytes32 commitment = keccak256(abi.encodePacked(expectedOutcome, salt));

        oracle.commitGame(sessionId, question, commitment);

        // Prepare reveal data
        address[] memory winners = new address[](2);
        winners[0] = user1;
        winners[1] = user2;
        uint256 totalPayout = 1000 ether;
        bytes memory teeQuote = "mock-tee-quote";

        vm.expectEmit(true, false, false, false);
        emit GameRevealed(sessionId, expectedOutcome, block.timestamp, teeQuote, 2);

        // Reveal
        oracle.revealGame(sessionId, expectedOutcome, salt, teeQuote, winners, totalPayout);

        // Verify outcome
        (bool outcome, bool finalized) = oracle.getOutcome(sessionId);
        assertTrue(outcome);
        assertTrue(finalized);

        // Verify winners
        assertTrue(oracle.isWinner(sessionId, user1));
        assertTrue(oracle.isWinner(sessionId, user2));
        assertFalse(oracle.isWinner(sessionId, address(0x3)));
    }

    function testCannotRevealWithWrongCommitment() public {
        // Setup: commit a game
        bytes32 sessionId = keccak256("game-1");
        string memory question = "Test question";
        bool expectedOutcome = true;
        bytes32 salt = bytes32(uint256(123));
        bytes32 commitment = keccak256(abi.encodePacked(expectedOutcome, salt));

        oracle.commitGame(sessionId, question, commitment);

        // Try to reveal with wrong outcome
        address[] memory winners = new address[](0);
        bytes memory teeQuote = "mock-tee-quote";

        vm.expectRevert("Commitment mismatch");
        oracle.revealGame(sessionId, false, salt, teeQuote, winners, 0); // Wrong outcome!
    }

    function testCannotRevealWithWrongSalt() public {
        // Setup: commit a game
        bytes32 sessionId = keccak256("game-1");
        string memory question = "Test question";
        bool expectedOutcome = true;
        bytes32 salt = bytes32(uint256(123));
        bytes32 commitment = keccak256(abi.encodePacked(expectedOutcome, salt));

        oracle.commitGame(sessionId, question, commitment);

        // Try to reveal with wrong salt
        address[] memory winners = new address[](0);
        bytes memory teeQuote = "mock-tee-quote";

        vm.expectRevert("Commitment mismatch");
        oracle.revealGame(sessionId, expectedOutcome, bytes32(uint256(999)), teeQuote, winners, 0); // Wrong salt!
    }

    function testOnlyGameServerCanCommit() public {
        vm.prank(user1); // Prank as non-gameServer
        
        bytes32 sessionId = keccak256("game-1");
        string memory question = "Test question";
        bytes32 commitment = keccak256("test");

        vm.expectRevert("Only game server");
        oracle.commitGame(sessionId, question, commitment);
    }

    function testOnlyGameServerCanReveal() public {
        // Setup: commit as gameServer
        bytes32 sessionId = keccak256("game-1");
        string memory question = "Test question";
        bytes32 salt = bytes32(uint256(123));
        bytes32 commitment = keccak256(abi.encodePacked(true, salt));
        oracle.commitGame(sessionId, question, commitment);

        // Try to reveal as non-gameServer
        vm.prank(user1);
        address[] memory winners = new address[](0);
        bytes memory teeQuote = "mock-tee-quote";

        vm.expectRevert("Only game server");
        oracle.revealGame(sessionId, true, salt, teeQuote, winners, 0);
    }

    function testGetGame() public {
        // Commit and reveal a game
        bytes32 sessionId = keccak256("game-1");
        string memory question = "Will ETH reach $5000?";
        bool expectedOutcome = true;
        bytes32 salt = bytes32(uint256(123));
        bytes32 commitment = keccak256(abi.encodePacked(expectedOutcome, salt));

        oracle.commitGame(sessionId, question, commitment);

        address[] memory winners = new address[](1);
        winners[0] = user1;
        uint256 totalPayout = 500 ether;
        bytes memory teeQuote = "mock-tee-quote";

        oracle.revealGame(sessionId, expectedOutcome, salt, teeQuote, winners, totalPayout);

        // Get full game details
        PredictionOracle.GameOutcome memory game = oracle.getGame(sessionId);

        assertEq(game.sessionId, sessionId);
        assertEq(game.question, question);
        assertTrue(game.outcome);
        assertTrue(game.finalized);
        assertEq(game.commitment, commitment);
        assertEq(game.salt, salt);
        assertEq(game.winners.length, 1);
        assertEq(game.winners[0], user1);
        assertEq(game.totalPayout, totalPayout);
    }

    function testGameCount() public {
        assertEq(oracle.gameCount(), 0);

        // Commit first game
        oracle.commitGame(
            keccak256("game-1"),
            "Question 1",
            keccak256("commitment-1")
        );
        assertEq(oracle.gameCount(), 1);

        // Commit second game
        oracle.commitGame(
            keccak256("game-2"),
            "Question 2",
            keccak256("commitment-2")
        );
        assertEq(oracle.gameCount(), 2);
    }

    function testCannotRevealNonexistentGame() public {
        bytes32 sessionId = keccak256("nonexistent");
        address[] memory winners = new address[](0);
        bytes memory teeQuote = "mock-tee-quote";

        vm.expectRevert("Game not found");
        oracle.revealGame(sessionId, true, bytes32(0), teeQuote, winners, 0);
    }

    function testCannotRevealGameTwice() public {
        // Setup and reveal once
        bytes32 sessionId = keccak256("game-1");
        string memory question = "Test question";
        bytes32 salt = bytes32(uint256(123));
        bytes32 commitment = keccak256(abi.encodePacked(true, salt));

        oracle.commitGame(sessionId, question, commitment);

        address[] memory winners = new address[](0);
        bytes memory teeQuote = "mock-tee-quote";

        oracle.revealGame(sessionId, true, salt, teeQuote, winners, 0);

        // Try to reveal again
        vm.expectRevert("Already finalized");
        oracle.revealGame(sessionId, true, salt, teeQuote, winners, 0);
    }
}


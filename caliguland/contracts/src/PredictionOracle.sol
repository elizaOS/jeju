// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title PredictionOracle
 * @notice TEE-backed oracle for prediction game outcomes
 * @dev Stores game results with TEE attestation for trustless verification
 */
contract PredictionOracle {
    struct GameOutcome {
        bytes32 sessionId;
        string question;
        bool outcome;              // true = YES, false = NO
        bytes32 commitment;        // Hash committed at game start
        bytes32 salt;              // Salt for commitment
        uint256 startTime;
        uint256 endTime;
        bytes teeQuote;            // TEE attestation quote
        address[] winners;
        uint256 totalPayout;
        bool finalized;
    }

    mapping(bytes32 => GameOutcome) public games;
    mapping(bytes32 => bool) public commitments;
    
    address public gameServer;
    uint256 public gameCount;

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

    modifier onlyGameServer() {
        require(msg.sender == gameServer, "Only game server");
        _;
    }

    constructor(address _gameServer) {
        gameServer = _gameServer;
    }

    /**
     * @notice Commit to a game outcome at start
     * @param sessionId Unique game session ID
     * @param question The yes/no question
     * @param commitment Hash of (outcome + salt)
     */
    function commitGame(
        bytes32 sessionId,
        string calldata question,
        bytes32 commitment
    ) external onlyGameServer {
        require(!commitments[commitment], "Commitment already exists");
        require(games[sessionId].startTime == 0, "Session already exists");

        games[sessionId] = GameOutcome({
            sessionId: sessionId,
            question: question,
            outcome: false,
            commitment: commitment,
            salt: bytes32(0),
            startTime: block.timestamp,
            endTime: 0,
            teeQuote: "",
            winners: new address[](0),
            totalPayout: 0,
            finalized: false
        });

        commitments[commitment] = true;
        gameCount++;

        emit GameCommitted(sessionId, question, commitment, block.timestamp);
    }

    /**
     * @notice Reveal game outcome with TEE proof
     * @param sessionId Game session ID
     * @param outcome The outcome (true=YES, false=NO)
     * @param salt Salt used in commitment
     * @param teeQuote TEE attestation quote
     * @param winners Array of winner addresses
     * @param totalPayout Total payout amount
     */
    function revealGame(
        bytes32 sessionId,
        bool outcome,
        bytes32 salt,
        bytes memory teeQuote,
        address[] calldata winners,
        uint256 totalPayout
    ) external onlyGameServer {
        GameOutcome storage game = games[sessionId];
        require(game.startTime > 0, "Game not found");
        require(!game.finalized, "Already finalized");

        // Verify commitment
        bytes32 computedCommitment = keccak256(abi.encodePacked(outcome, salt));
        require(computedCommitment == game.commitment, "Commitment mismatch");

        // TODO: Verify TEE quote with DstackVerifier

        // Store results
        game.outcome = outcome;
        game.salt = salt;
        game.endTime = block.timestamp;
        game.teeQuote = teeQuote;
        game.winners = winners;
        game.totalPayout = totalPayout;
        game.finalized = true;

        emit GameRevealed(sessionId, outcome, block.timestamp, teeQuote, winners.length);
    }

    /**
     * @notice Get game outcome (for external contracts)
     * @param sessionId Game session ID
     * @return outcome The game outcome (true=YES, false=NO)
     * @return finalized Whether the game is finalized
     */
    function getOutcome(bytes32 sessionId) external view returns (bool outcome, bool finalized) {
        GameOutcome storage game = games[sessionId];
        return (game.outcome, game.finalized);
    }

    /**
     * @notice Get full game details
     */
    function getGame(bytes32 sessionId) external view returns (GameOutcome memory) {
        return games[sessionId];
    }

    /**
     * @notice Verify a commitment exists
     */
    function verifyCommitment(bytes32 commitment) external view returns (bool) {
        return commitments[commitment];
    }

    /**
     * @notice Check if an address won a specific game
     */
    function isWinner(bytes32 sessionId, address player) external view returns (bool) {
        GameOutcome storage game = games[sessionId];
        for (uint256 i = 0; i < game.winners.length; i++) {
            if (game.winners[i] == player) {
                return true;
            }
        }
        return false;
    }
}


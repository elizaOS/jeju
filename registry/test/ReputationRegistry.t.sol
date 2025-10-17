// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/IdentityRegistry.sol";
import "../src/ReputationRegistry.sol";

/**
 * @title ReputationRegistryTest
 * @dev Comprehensive test suite for ERC-8004 v1.0 Reputation Registry
 * @author ChaosChain Labs
 */
contract ReputationRegistryTest is Test {
    IdentityRegistry public identityRegistry;
    ReputationRegistry public reputationRegistry;
    
    uint256 public agentOwnerPk = 0xA11CE;
    uint256 public clientPk = 0xB0B;
    
    address public agentOwner;
    address public client;
    address public client2 = address(0x3);
    address public responder = address(0x4);
    
    uint256 public agentId;
    
    string constant TOKEN_URI = "ipfs://QmTest/agent.json";
    string constant FEEDBACK_URI = "ipfs://QmFeedback/feedback.json";
    string constant RESPONSE_URI = "ipfs://QmResponse/response.json";
    
    bytes32 constant TAG1 = bytes32("quality");
    bytes32 constant TAG2 = bytes32("speed");
    
    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint8 score,
        bytes32 indexed tag1,
        bytes32 tag2,
        string fileuri,
        bytes32 filehash
    );
    
    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 indexed feedbackIndex
    );
    
    event ResponseAppended(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        address indexed responder,
        string responseUri,
        bytes32 responseHash
    );

    function setUp() public {
        // Derive addresses from private keys
        agentOwner = vm.addr(agentOwnerPk);
        client = vm.addr(clientPk);
        
        identityRegistry = new IdentityRegistry();
        reputationRegistry = new ReputationRegistry(address(identityRegistry));
        
        // Register agent
        vm.prank(agentOwner);
        agentId = identityRegistry.register(TOKEN_URI);
    }
    
    // ============ Helper Functions ============
    
    function _createFeedbackAuth(
        uint256 _agentId,
        address _clientAddress,
        uint64 _indexLimit,
        uint256 _expiry,
        address _signerAddress,
        uint256 _signerPk
    ) internal view returns (bytes memory) {
        // Encode the struct as per ERC-8004 v1.0 spec
        bytes32 structHash = keccak256(abi.encode(
            _agentId,
            _clientAddress,
            _indexLimit,
            _expiry,
            block.chainid,
            address(identityRegistry),
            _signerAddress
        ));
        
        // EIP-191 personal sign format: "\x19Ethereum Signed Message:\n32" + hash
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", structHash));
        
        // Sign the message hash
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(_signerPk, messageHash);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Encode the struct fields + signature
        return abi.encodePacked(
            abi.encode(
                _agentId,
                _clientAddress,
                _indexLimit,
                _expiry,
                block.chainid,
                address(identityRegistry),
                _signerAddress
            ),
            signature
        );
    }
    
    // ============ Give Feedback Tests ============
    
    function test_GiveFeedback_Success() public {
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        vm.expectEmit(true, true, true, true);
        emit NewFeedback(agentId, client, 95, TAG1, TAG2, FEEDBACK_URI, keccak256("test"));
        
        reputationRegistry.giveFeedback(
            agentId,
            95,
            TAG1,
            TAG2,
            FEEDBACK_URI,
            keccak256("test"),
            feedbackAuth
        );
        
        // Verify feedback was stored
        (uint8 score, bytes32 tag1, bytes32 tag2, bool isRevoked) = reputationRegistry.readFeedback(agentId, client, 1);
        assertEq(score, 95);
        assertEq(tag1, TAG1);
        assertEq(tag2, TAG2);
        assertFalse(isRevoked);
        
        // Verify client was added
        address[] memory clients = reputationRegistry.getClients(agentId);
        assertEq(clients.length, 1);
        assertEq(clients[0], client);
        
        // Verify last index
        assertEq(reputationRegistry.getLastIndex(agentId, client), 1);
    }
    
    function test_GiveFeedback_MultipleFeedbacks() public {
        // First feedback
        bytes memory feedbackAuth1 = _createFeedbackAuth(
            agentId,
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        reputationRegistry.giveFeedback(agentId, 90, TAG1, TAG2, FEEDBACK_URI, bytes32(0), feedbackAuth1);
        
        // Second feedback
        bytes memory feedbackAuth2 = _createFeedbackAuth(
            agentId,
            client,
            2,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        reputationRegistry.giveFeedback(agentId, 95, TAG1, TAG2, FEEDBACK_URI, bytes32(0), feedbackAuth2);
        
        assertEq(reputationRegistry.getLastIndex(agentId, client), 2);
        
        (uint8 score1,,,) = reputationRegistry.readFeedback(agentId, client, 1);
        (uint8 score2,,,) = reputationRegistry.readFeedback(agentId, client, 2);
        
        assertEq(score1, 90);
        assertEq(score2, 95);
    }
    
    function test_GiveFeedback_MultipleClients() public {
        // Client 1 feedback
        bytes memory feedbackAuth1 = _createFeedbackAuth(
            agentId,
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        reputationRegistry.giveFeedback(agentId, 90, TAG1, TAG2, "", bytes32(0), feedbackAuth1);
        
        // Client 2 feedback
        bytes memory feedbackAuth2 = _createFeedbackAuth(
            agentId,
            client2,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client2);
        reputationRegistry.giveFeedback(agentId, 85, TAG1, TAG2, "", bytes32(0), feedbackAuth2);
        
        address[] memory clients = reputationRegistry.getClients(agentId);
        assertEq(clients.length, 2);
    }
    
    function test_GiveFeedback_ScoreTooHigh_Reverts() public {
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        vm.expectRevert("Score must be 0-100");
        reputationRegistry.giveFeedback(agentId, 101, TAG1, TAG2, "", bytes32(0), feedbackAuth);
    }
    
    function test_GiveFeedback_NonExistentAgent_Reverts() public {
        bytes memory feedbackAuth = _createFeedbackAuth(
            999,
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        vm.expectRevert("Agent does not exist");
        reputationRegistry.giveFeedback(999, 90, TAG1, TAG2, "", bytes32(0), feedbackAuth);
    }
    
    function test_GiveFeedback_WrongAgentId_Reverts() public {
        bytes memory feedbackAuth = _createFeedbackAuth(
            999, // Wrong agent ID in auth
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        vm.expectRevert("AgentId mismatch");
        reputationRegistry.giveFeedback(agentId, 90, TAG1, TAG2, "", bytes32(0), feedbackAuth);
    }
    
    function test_GiveFeedback_WrongClientAddress_Reverts() public {
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            client2, // Wrong client in auth
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        vm.expectRevert("ClientAddress mismatch");
        reputationRegistry.giveFeedback(agentId, 90, TAG1, TAG2, "", bytes32(0), feedbackAuth);
    }
    
    function test_GiveFeedback_Expired_Reverts() public {
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            client,
            1,
            block.timestamp - 1, // Expired
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        vm.expectRevert("Authorization expired");
        reputationRegistry.giveFeedback(agentId, 90, TAG1, TAG2, "", bytes32(0), feedbackAuth);
    }
    
    function test_GiveFeedback_IndexLimitExceeded_Reverts() public {
        // Give first feedback
        bytes memory feedbackAuth1 = _createFeedbackAuth(
            agentId,
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        reputationRegistry.giveFeedback(agentId, 90, TAG1, TAG2, "", bytes32(0), feedbackAuth1);
        
        // Try to give second feedback with indexLimit = 1
        bytes memory feedbackAuth2 = _createFeedbackAuth(
            agentId,
            client,
            1, // Index limit too low
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        vm.expectRevert("Index limit exceeded");
        reputationRegistry.giveFeedback(agentId, 95, TAG1, TAG2, "", bytes32(0), feedbackAuth2);
    }
    
    function test_GiveFeedback_InvalidSigner_Reverts() public {
        // Sign with wrong private key
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            clientPk // Wrong private key
        );
        
        vm.prank(client);
        vm.expectRevert("Invalid signature");
        reputationRegistry.giveFeedback(agentId, 90, TAG1, TAG2, "", bytes32(0), feedbackAuth);
    }
    
    function test_GiveFeedback_SelfFeedback_Reverts() public {
        // Agent owner attempts to give feedback to themselves
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            agentOwner, // client is the agent owner
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(agentOwner);
        vm.expectRevert("Self-feedback not allowed");
        reputationRegistry.giveFeedback(agentId, 100, TAG1, TAG2, "", bytes32(0), feedbackAuth);
    }
    
    // ============ Revoke Feedback Tests ============
    
    function test_RevokeFeedback_Success() public {
        // Give feedback first
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        reputationRegistry.giveFeedback(agentId, 90, TAG1, TAG2, "", bytes32(0), feedbackAuth);
        
        // Revoke it
        vm.prank(client);
        vm.expectEmit(true, true, true, false);
        emit FeedbackRevoked(agentId, client, 1);
        
        reputationRegistry.revokeFeedback(agentId, 1);
        
        // Verify revoked
        (,,,bool isRevoked) = reputationRegistry.readFeedback(agentId, client, 1);
        assertTrue(isRevoked);
    }
    
    function test_RevokeFeedback_InvalidIndex_Reverts() public {
        vm.prank(client);
        vm.expectRevert("Invalid index");
        reputationRegistry.revokeFeedback(agentId, 1);
    }
    
    function test_RevokeFeedback_AlreadyRevoked_Reverts() public {
        // Give and revoke feedback
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.startPrank(client);
        reputationRegistry.giveFeedback(agentId, 90, TAG1, TAG2, "", bytes32(0), feedbackAuth);
        reputationRegistry.revokeFeedback(agentId, 1);
        
        // Try to revoke again
        vm.expectRevert("Already revoked");
        reputationRegistry.revokeFeedback(agentId, 1);
        vm.stopPrank();
    }
    
    // ============ Append Response Tests ============
    
    function test_AppendResponse_Success() public {
        // Give feedback first
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        reputationRegistry.giveFeedback(agentId, 90, TAG1, TAG2, FEEDBACK_URI, bytes32(0), feedbackAuth);
        
        // Append response
        vm.prank(responder);
        bytes32 responseHash = keccak256("response");
        vm.expectEmit(true, true, false, true);
        emit ResponseAppended(agentId, client, 1, responder, RESPONSE_URI, responseHash);
        
        reputationRegistry.appendResponse(agentId, client, 1, RESPONSE_URI, responseHash);
    }
    
    function test_AppendResponse_MultipleResponders() public {
        // Give feedback
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        reputationRegistry.giveFeedback(agentId, 90, TAG1, TAG2, "", bytes32(0), feedbackAuth);
        
        // Multiple responses
        vm.prank(responder);
        reputationRegistry.appendResponse(agentId, client, 1, RESPONSE_URI, bytes32(0));
        
        vm.prank(agentOwner);
        reputationRegistry.appendResponse(agentId, client, 1, "ipfs://QmRefund", bytes32(0));
        
        // Verify response count
        address[] memory responders = new address[](2);
        responders[0] = responder;
        responders[1] = agentOwner;
        
        uint64 count = reputationRegistry.getResponseCount(agentId, client, 1, responders);
        assertEq(count, 2);
    }
    
    function test_AppendResponse_InvalidIndex_Reverts() public {
        vm.prank(responder);
        vm.expectRevert("Invalid index");
        reputationRegistry.appendResponse(agentId, client, 1, RESPONSE_URI, bytes32(0));
    }
    
    function test_AppendResponse_EmptyURI_Reverts() public {
        // Give feedback first
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            client,
            1,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(client);
        reputationRegistry.giveFeedback(agentId, 90, TAG1, TAG2, "", bytes32(0), feedbackAuth);
        
        vm.prank(responder);
        vm.expectRevert("Empty URI");
        reputationRegistry.appendResponse(agentId, client, 1, "", bytes32(0));
    }
    
    // ============ Read Functions Tests ============
    
    function test_GetSummary_NoFilters() public {
        // Give multiple feedbacks
        _giveFeedback(client, 90);
        _giveFeedback(client2, 80);
        
        address[] memory emptyClients = new address[](0);
        (uint64 count, uint8 avgScore) = reputationRegistry.getSummary(agentId, emptyClients, bytes32(0), bytes32(0));
        
        assertEq(count, 2);
        assertEq(avgScore, 85); // (90 + 80) / 2
    }
    
    function test_GetSummary_FilterByClient() public {
        _giveFeedback(client, 90);
        _giveFeedback(client2, 80);
        
        address[] memory clients = new address[](1);
        clients[0] = client;
        
        (uint64 count, uint8 avgScore) = reputationRegistry.getSummary(agentId, clients, bytes32(0), bytes32(0));
        
        assertEq(count, 1);
        assertEq(avgScore, 90);
    }
    
    function test_GetSummary_FilterByTags() public {
        bytes32 tag1A = bytes32("quality");
        bytes32 tag1B = bytes32("other");
        
        _giveFeedbackWithTags(client, 90, tag1A, TAG2);
        _giveFeedbackWithTags(client2, 80, tag1B, TAG2);
        
        address[] memory emptyClients = new address[](0);
        (uint64 count, uint8 avgScore) = reputationRegistry.getSummary(agentId, emptyClients, tag1A, bytes32(0));
        
        assertEq(count, 1);
        assertEq(avgScore, 90);
    }
    
    function test_GetSummary_ExcludesRevoked() public {
        _giveFeedback(client, 90);
        _giveFeedback(client2, 80);
        
        // Revoke first feedback
        vm.prank(client);
        reputationRegistry.revokeFeedback(agentId, 1);
        
        address[] memory emptyClients = new address[](0);
        (uint64 count, uint8 avgScore) = reputationRegistry.getSummary(agentId, emptyClients, bytes32(0), bytes32(0));
        
        assertEq(count, 1);
        assertEq(avgScore, 80); // Only client2's feedback
    }
    
    function test_ReadAllFeedback_Success() public {
        _giveFeedback(client, 90);
        _giveFeedback(client2, 85);
        
        address[] memory emptyClients = new address[](0);
        (
            address[] memory clients,
            uint8[] memory scores,
            bytes32[] memory tag1s,
            bytes32[] memory tag2s,
            bool[] memory revokedStatuses
        ) = reputationRegistry.readAllFeedback(agentId, emptyClients, bytes32(0), bytes32(0), false);
        
        assertEq(clients.length, 2);
        assertEq(scores.length, 2);
        assertEq(scores[0], 90);
        assertEq(scores[1], 85);
        assertFalse(revokedStatuses[0]);
        assertFalse(revokedStatuses[1]);
    }
    
    function test_ReadAllFeedback_ExcludesRevoked() public {
        _giveFeedback(client, 90);
        _giveFeedback(client2, 85);
        
        vm.prank(client);
        reputationRegistry.revokeFeedback(agentId, 1);
        
        address[] memory emptyClients = new address[](0);
        (
            address[] memory clients,
            uint8[] memory scores,,,
        ) = reputationRegistry.readAllFeedback(agentId, emptyClients, bytes32(0), bytes32(0), false);
        
        assertEq(clients.length, 1);
        assertEq(scores[0], 85); // Only client2's feedback
    }
    
    function test_GetClients_ReturnsAllClients() public {
        _giveFeedback(client, 90);
        _giveFeedback(client2, 85);
        
        address[] memory clients = reputationRegistry.getClients(agentId);
        assertEq(clients.length, 2);
        assertEq(clients[0], client);
        assertEq(clients[1], client2);
    }
    
    function test_GetIdentityRegistry_ReturnsCorrectAddress() public {
        assertEq(reputationRegistry.getIdentityRegistry(), address(identityRegistry));
    }
    
    // ============ Helper Functions for Tests ============
    
    function _giveFeedback(address _client, uint8 score) internal {
        uint64 nextIndex = reputationRegistry.getLastIndex(agentId, _client) + 1;
        
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            _client,
            nextIndex,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(_client);
        reputationRegistry.giveFeedback(agentId, score, TAG1, TAG2, "", bytes32(0), feedbackAuth);
    }
    
    function _giveFeedbackWithTags(address _client, uint8 score, bytes32 tag1, bytes32 tag2) internal {
        uint64 nextIndex = reputationRegistry.getLastIndex(agentId, _client) + 1;
        
        bytes memory feedbackAuth = _createFeedbackAuth(
            agentId,
            _client,
            nextIndex,
            block.timestamp + 1 days,
            agentOwner,
            agentOwnerPk
        );
        
        vm.prank(_client);
        reputationRegistry.giveFeedback(agentId, score, tag1, tag2, "", bytes32(0), feedbackAuth);
    }
}

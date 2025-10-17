// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IIdentityRegistry.sol";

/**
 * @title IdentityRegistry
 * @author Jeju Network (adapted from ChaosChain Labs)
 * @notice ERC-8004 v1.0 compliant agent identity registry using ERC-721 NFTs
 * @dev Each agent is represented as an ERC-721 NFT, making agents immediately browsable
 *      and transferable with NFT-compliant applications. Provides on-chain metadata storage.
 * 
 * Architecture:
 * - ERC-721 compliance with URIStorage extension for off-chain metadata
 * - On-chain key-value metadata storage for critical data
 * - Flexible registration with multiple overloads
 * - Transferable agent ownership via NFT standards
 * 
 * Use Cases:
 * - AI agent registration and discovery
 * - Agent reputation and validation tracking
 * - Decentralized agent marketplace
 * - Multi-agent system coordination
 * 
 * Integration with Jeju:
 * - Agents can earn fees through paymaster system
 * - Agent NFTs can gate access to premium features
 * - Reputation data influences trustworthiness scores
 * 
 * @custom:security-contact security@jeju.network
 */
contract IdentityRegistry is ERC721URIStorage, ReentrancyGuard, IIdentityRegistry {
    // ============ State Variables ============
    
    /// @notice Counter for agent IDs (tokenIds)
    /// @dev Starts at 1, incremented for each new agent registration
    uint256 private _nextAgentId;
    
    /// @notice Mapping from agentId to metadata key to metadata value
    /// @dev Stores on-chain metadata for each agent
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    // ============ Constructor ============
    
    /**
     * @notice Initializes the ERC-721 contract with name and symbol
     * @dev Agent IDs start from 1 (0 is reserved for non-existent agents)
     */
    constructor() ERC721("ERC-8004 Trustless Agent", "AGENT") {
        _nextAgentId = 1; // Start from 1, 0 is invalid
    }

    // ============ Registration Functions ============
    
    /**
     * @notice Register a new agent with tokenURI and metadata
     * @param tokenURI_ The URI pointing to the agent's registration JSON file
     * @param metadata Array of metadata entries to set for the agent
     * @return agentId The newly assigned agent ID
     */
    function register(
        string calldata tokenURI_, 
        MetadataEntry[] calldata metadata
    ) external nonReentrant returns (uint256 agentId) {
        agentId = _mintAgent(msg.sender, tokenURI_);
        
        // Set metadata if provided
        if (metadata.length > 0) {
            _setMetadataBatch(agentId, metadata);
        }
    }
    
    /**
     * @notice Register a new agent with tokenURI only
     * @param tokenURI_ The URI pointing to the agent's registration JSON file
     * @return agentId The newly assigned agent ID
     */
    function register(string calldata tokenURI_) external nonReentrant returns (uint256 agentId) {
        agentId = _mintAgent(msg.sender, tokenURI_);
    }
    
    /**
     * @notice Register a new agent without tokenURI (can be set later)
     * @dev The tokenURI can be set later using _setTokenURI() by the owner
     * @return agentId The newly assigned agent ID
     */
    function register() external nonReentrant returns (uint256 agentId) {
        agentId = _mintAgent(msg.sender, "");
    }

    // ============ Metadata Functions ============
    
    /**
     * @notice Set metadata for an agent
     * @dev Only the owner or approved operator can set metadata
     * @param agentId The agent ID
     * @param key The metadata key
     * @param value The metadata value as bytes
     */
    function setMetadata(
        uint256 agentId, 
        string calldata key, 
        bytes calldata value
    ) external {
        address owner = ownerOf(agentId);
        require(
            msg.sender == owner || 
            isApprovedForAll(owner, msg.sender) || 
            getApproved(agentId) == msg.sender,
            "Not authorized"
        );
        require(bytes(key).length > 0, "Empty key");
        
        _metadata[agentId][key] = value;
        
        emit MetadataSet(agentId, key, key, value);
    }
    
    /**
     * @notice Get metadata for an agent
     * @param agentId The agent ID
     * @param key The metadata key
     * @return value The metadata value as bytes
     */
    function getMetadata(
        uint256 agentId, 
        string calldata key
    ) external view returns (bytes memory value) {
        require(_ownerOf(agentId) != address(0), "Agent does not exist");
        return _metadata[agentId][key];
    }

    // ============ View Functions ============
    
    /**
     * @notice Get the total number of registered agents
     * @return count The total number of agents
     */
    function totalAgents() external view returns (uint256 count) {
        return _nextAgentId - 1;
    }
    
    /**
     * @notice Check if an agent exists
     * @param agentId The agent ID to check
     * @return exists True if the agent exists
     */
    function agentExists(uint256 agentId) external view returns (bool exists) {
        return _ownerOf(agentId) != address(0);
    }

    // ============ Internal Functions ============
    
    /**
     * @dev Mints a new agent NFT
     * @param to The address to mint the agent to
     * @param tokenURI_ The token URI
     * @return agentId The newly minted agent ID
     */
    function _mintAgent(
        address to, 
        string memory tokenURI_
    ) internal returns (uint256 agentId) {
        agentId = _nextAgentId;
        unchecked {
            _nextAgentId++;
        }
        
        _safeMint(to, agentId);
        
        if (bytes(tokenURI_).length > 0) {
            _setTokenURI(agentId, tokenURI_);
        }
        
        emit Registered(agentId, tokenURI_, to);
    }
    
    /**
     * @notice Returns the contract version
     * @return Version string in semver format
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
    
    /**
     * @dev Sets multiple metadata entries in batch
     * @param agentId The agent ID
     * @param metadata Array of metadata entries
     */
    function _setMetadataBatch(
        uint256 agentId, 
        MetadataEntry[] calldata metadata
    ) internal {
        for (uint256 i = 0; i < metadata.length; i++) {
            require(bytes(metadata[i].key).length > 0, "Empty key");
            _metadata[agentId][metadata[i].key] = metadata[i].value;
            emit MetadataSet(
                agentId, 
                metadata[i].key, 
                metadata[i].key, 
                metadata[i].value
            );
        }
    }
}

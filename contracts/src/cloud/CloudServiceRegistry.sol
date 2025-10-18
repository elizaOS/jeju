// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CloudServiceRegistry
 * @author Jeju Network
 * @notice Registry for cloud service pricing, usage tracking, and volume discounts
 * @dev Manages pricing for AI cloud services (chat, image gen, video gen, containers)
 *      with dynamic pricing based on demand and volume discounts for power users.
 *
 * Service Types:
 * - chat-completion: Text generation (GPT, Claude, etc.)
 * - image-generation: Image generation (DALL-E, Stable Diffusion, etc.)
 * - video-generation: Video generation (Runway, etc.)
 * - container: Container hosting and execution
 *
 * Pricing Model:
 * - Base price per service type
 * - Volume discounts for high-usage users
 * - Demand multipliers during peak usage
 * - Oracle-based USD pricing converted to elizaOS tokens
 *
 * @custom:security-contact security@jeju.network
 */
contract CloudServiceRegistry is Ownable, Pausable, ReentrancyGuard {
    // ============ Structs ============

    struct ServiceConfig {
        uint256 basePriceElizaOS;      // Base price in elizaOS tokens (18 decimals)
        uint256 demandMultiplier;       // Current demand multiplier (basis points)
        uint256 totalUsageCount;        // Total times this service has been used
        uint256 totalRevenueElizaOS;    // Total revenue generated in elizaOS
        bool isActive;                  // Whether service is accepting requests
        uint256 minPrice;               // Minimum price floor
        uint256 maxPrice;               // Maximum price ceiling
    }

    struct UserUsage {
        uint256 totalSpent;             // Total elizaOS spent by user
        uint256 requestCount;           // Total requests made
        uint256 lastUsedBlock;          // Last block user used service
        uint256 volumeDiscount;         // User's volume discount (basis points)
    }

    struct UsageRecord {
        address user;
        string serviceName;
        uint256 cost;
        bytes32 sessionId;
        uint256 timestamp;
        uint256 blockNumber;
    }

    // ============ State Variables ============

    /// @notice Mapping of service name => service configuration
    mapping(string => ServiceConfig) public services;

    /// @notice Mapping of user => service => usage stats
    mapping(address => mapping(string => UserUsage)) public userUsage;

    /// @notice Mapping of session ID => usage record for audit trail
    mapping(bytes32 => UsageRecord) public usageRecords;

    /// @notice List of all registered service names
    string[] public serviceNames;

    /// @notice Basis points denominator (10000 = 100%)
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice Volume discount tiers (spending thresholds in elizaOS)
    uint256[] public volumeTiers = [
        0,                  // 0%    - 0 spent
        1000 * 1e18,       // 5%    - 1,000 elizaOS
        5000 * 1e18,       // 10%   - 5,000 elizaOS
        10000 * 1e18,      // 15%   - 10,000 elizaOS
        50000 * 1e18       // 20%   - 50,000 elizaOS
    ];

    /// @notice Volume discount rates (basis points)
    uint256[] public volumeDiscounts = [
        0,      // 0% discount
        500,    // 5% discount
        1000,   // 10% discount
        1500,   // 15% discount
        2000    // 20% discount
    ];

    /// @notice Treasury address for revenue collection
    address public treasury;

    /// @notice Authorized callers (paymasters) that can record usage
    mapping(address => bool) public authorizedCallers;

    // ============ Events ============

    event ServiceRegistered(
        string indexed serviceName,
        uint256 basePriceElizaOS,
        uint256 minPrice,
        uint256 maxPrice
    );

    event ServicePriceUpdated(
        string indexed serviceName,
        uint256 oldPrice,
        uint256 newPrice
    );

    event ServiceUsageRecorded(
        address indexed user,
        string serviceName,
        uint256 cost,
        bytes32 sessionId,
        uint256 volumeDiscount
    );

    event DemandMultiplierUpdated(
        string indexed serviceName,
        uint256 oldMultiplier,
        uint256 newMultiplier
    );

    event VolumeTiersUpdated(uint256[] newTiers, uint256[] newDiscounts);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    // ============ Errors ============

    error ServiceNotFound(string serviceName);
    error ServiceAlreadyExists(string serviceName);
    error ServiceNotActive(string serviceName);
    error InvalidPrice(uint256 price);
    error InvalidMultiplier(uint256 multiplier);
    error InvalidTierArrays();
    error UnauthorizedCaller();
    error InvalidTreasuryAddress();

    // ============ Constructor ============

    constructor(address _treasury) Ownable(msg.sender) {
        if (_treasury == address(0)) revert InvalidTreasuryAddress();
        treasury = _treasury;

        // Register default services with initial pricing
        _registerService("chat-completion", 10 * 1e18, 1 * 1e18, 100 * 1e18);      // $10 base
        _registerService("image-generation", 50 * 1e18, 5 * 1e18, 500 * 1e18);     // $50 base
        _registerService("video-generation", 200 * 1e18, 20 * 1e18, 2000 * 1e18);  // $200 base
        _registerService("container", 5 * 1e18, 1 * 1e18, 50 * 1e18);              // $5 base (per hour)
    }

    // ============ Core Functions ============

    /**
     * @notice Get current cost for a service for a specific user (with discounts)
     * @param serviceName Name of the service
     * @param user User address (for volume discount calculation)
     * @return cost Final cost in elizaOS tokens after discounts
     */
    function getServiceCost(
        string calldata serviceName,
        address user
    ) external view returns (uint256 cost) {
        ServiceConfig memory service = services[serviceName];

        if (!service.isActive) revert ServiceNotActive(serviceName);
        if (service.basePriceElizaOS == 0) revert ServiceNotFound(serviceName);

        // Start with base price
        cost = service.basePriceElizaOS;

        // Apply demand multiplier
        cost = (cost * service.demandMultiplier) / BASIS_POINTS;

        // Apply volume discount for user
        uint256 discount = _getUserVolumeDiscount(user, serviceName);
        if (discount > 0) {
            cost = cost - ((cost * discount) / BASIS_POINTS);
        }

        // Enforce min/max bounds
        if (cost < service.minPrice) cost = service.minPrice;
        if (cost > service.maxPrice) cost = service.maxPrice;
    }

    /**
     * @notice Record service usage and update user statistics
     * @dev Only callable by authorized callers (paymasters)
     * @param user User who used the service
     * @param serviceName Name of the service used
     * @param actualCost Actual cost charged (in elizaOS)
     * @param sessionId Unique session identifier for tracking
     */
    function recordUsage(
        address user,
        string calldata serviceName,
        uint256 actualCost,
        bytes32 sessionId
    ) external nonReentrant whenNotPaused {
        if (!authorizedCallers[msg.sender]) revert UnauthorizedCaller();

        ServiceConfig storage service = services[serviceName];
        if (!service.isActive) revert ServiceNotActive(serviceName);
        if (service.basePriceElizaOS == 0) revert ServiceNotFound(serviceName);

        // Update service stats
        service.totalUsageCount++;
        service.totalRevenueElizaOS += actualCost;

        // Update user stats
        UserUsage storage usage = userUsage[user][serviceName];
        usage.totalSpent += actualCost;
        usage.requestCount++;
        usage.lastUsedBlock = block.number;

        // Recalculate user's volume discount based on new spending
        usage.volumeDiscount = _calculateVolumeDiscount(usage.totalSpent);

        // Store usage record for audit trail
        usageRecords[sessionId] = UsageRecord({
            user: user,
            serviceName: serviceName,
            cost: actualCost,
            sessionId: sessionId,
            timestamp: block.timestamp,
            blockNumber: block.number
        });

        emit ServiceUsageRecorded(user, serviceName, actualCost, sessionId, usage.volumeDiscount);
    }

    // ============ Admin Functions ============

    /**
     * @notice Register a new service type
     * @param serviceName Unique name for the service
     * @param basePriceElizaOS Base price in elizaOS tokens
     * @param minPrice Minimum price floor
     * @param maxPrice Maximum price ceiling
     */
    function registerService(
        string calldata serviceName,
        uint256 basePriceElizaOS,
        uint256 minPrice,
        uint256 maxPrice
    ) external onlyOwner {
        _registerService(serviceName, basePriceElizaOS, minPrice, maxPrice);
    }

    /**
     * @notice Update base price for a service
     * @param serviceName Name of the service
     * @param newBasePriceElizaOS New base price in elizaOS tokens
     */
    function updateServicePrice(
        string calldata serviceName,
        uint256 newBasePriceElizaOS
    ) external onlyOwner {
        ServiceConfig storage service = services[serviceName];
        if (service.basePriceElizaOS == 0) revert ServiceNotFound(serviceName);
        if (newBasePriceElizaOS == 0) revert InvalidPrice(newBasePriceElizaOS);

        uint256 oldPrice = service.basePriceElizaOS;
        service.basePriceElizaOS = newBasePriceElizaOS;

        emit ServicePriceUpdated(serviceName, oldPrice, newBasePriceElizaOS);
    }

    /**
     * @notice Update demand multiplier for dynamic pricing
     * @param serviceName Name of the service
     * @param newMultiplier New multiplier in basis points (10000 = 1x)
     */
    function updateDemandMultiplier(
        string calldata serviceName,
        uint256 newMultiplier
    ) external onlyOwner {
        ServiceConfig storage service = services[serviceName];
        if (service.basePriceElizaOS == 0) revert ServiceNotFound(serviceName);
        if (newMultiplier < 5000 || newMultiplier > 50000) revert InvalidMultiplier(newMultiplier);

        uint256 oldMultiplier = service.demandMultiplier;
        service.demandMultiplier = newMultiplier;

        emit DemandMultiplierUpdated(serviceName, oldMultiplier, newMultiplier);
    }

    /**
     * @notice Enable or disable a service
     * @param serviceName Name of the service
     * @param isActive Whether service should be active
     */
    function setServiceActive(
        string calldata serviceName,
        bool isActive
    ) external onlyOwner {
        ServiceConfig storage service = services[serviceName];
        if (service.basePriceElizaOS == 0) revert ServiceNotFound(serviceName);

        service.isActive = isActive;
    }

    /**
     * @notice Update volume discount tiers and rates
     * @param newTiers Array of spending thresholds (must be ascending)
     * @param newDiscounts Array of discount rates in basis points
     */
    function updateVolumeTiers(
        uint256[] calldata newTiers,
        uint256[] calldata newDiscounts
    ) external onlyOwner {
        if (newTiers.length != newDiscounts.length) revert InvalidTierArrays();
        if (newTiers.length == 0) revert InvalidTierArrays();

        // Verify tiers are ascending
        for (uint256 i = 1; i < newTiers.length; i++) {
            if (newTiers[i] <= newTiers[i - 1]) revert InvalidTierArrays();
        }

        // Verify discounts are valid (0-50%)
        for (uint256 i = 0; i < newDiscounts.length; i++) {
            if (newDiscounts[i] > 5000) revert InvalidTierArrays();
        }

        volumeTiers = newTiers;
        volumeDiscounts = newDiscounts;

        emit VolumeTiersUpdated(newTiers, newDiscounts);
    }

    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTreasuryAddress();

        address oldTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Authorize or deauthorize a caller (paymaster)
     * @param caller Address to authorize/deauthorize
     * @param authorized Whether caller should be authorized
     */
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============

    /**
     * @notice Get all service names
     * @return Array of service names
     */
    function getAllServices() external view returns (string[] memory) {
        return serviceNames;
    }

    /**
     * @notice Get user's total usage across all services
     * @param user User address
     * @return totalSpent Total elizaOS spent across all services
     * @return totalRequests Total requests made across all services
     */
    function getUserTotalUsage(
        address user
    ) external view returns (uint256 totalSpent, uint256 totalRequests) {
        for (uint256 i = 0; i < serviceNames.length; i++) {
            UserUsage memory usage = userUsage[user][serviceNames[i]];
            totalSpent += usage.totalSpent;
            totalRequests += usage.requestCount;
        }
    }

    /**
     * @notice Get user's current volume discount percentage
     * @param user User address
     * @param serviceName Service to check discount for
     * @return discount Discount in basis points
     */
    function getUserVolumeDiscount(
        address user,
        string calldata serviceName
    ) external view returns (uint256 discount) {
        return _getUserVolumeDiscount(user, serviceName);
    }

    /**
     * @notice Get service statistics
     * @param serviceName Service to get stats for
     * @return config Service configuration
     */
    function getServiceStats(
        string calldata serviceName
    ) external view returns (ServiceConfig memory config) {
        return services[serviceName];
    }

    // ============ Internal Functions ============

    /**
     * @notice Internal function to register a new service
     */
    function _registerService(
        string memory serviceName,
        uint256 basePriceElizaOS,
        uint256 minPrice,
        uint256 maxPrice
    ) internal {
        if (services[serviceName].basePriceElizaOS != 0) {
            revert ServiceAlreadyExists(serviceName);
        }
        if (basePriceElizaOS == 0) revert InvalidPrice(basePriceElizaOS);
        if (minPrice > basePriceElizaOS) revert InvalidPrice(minPrice);
        if (maxPrice < basePriceElizaOS) revert InvalidPrice(maxPrice);

        services[serviceName] = ServiceConfig({
            basePriceElizaOS: basePriceElizaOS,
            demandMultiplier: BASIS_POINTS, // 1x default
            totalUsageCount: 0,
            totalRevenueElizaOS: 0,
            isActive: true,
            minPrice: minPrice,
            maxPrice: maxPrice
        });

        serviceNames.push(serviceName);

        emit ServiceRegistered(serviceName, basePriceElizaOS, minPrice, maxPrice);
    }

    /**
     * @notice Calculate volume discount based on total spending
     * @param totalSpent Total amount spent by user
     * @return discount Discount rate in basis points
     */
    function _calculateVolumeDiscount(uint256 totalSpent) internal view returns (uint256 discount) {
        for (uint256 i = volumeTiers.length - 1; i > 0; i--) {
            if (totalSpent >= volumeTiers[i]) {
                return volumeDiscounts[i];
            }
        }
        return volumeDiscounts[0]; // No discount
    }

    /**
     * @notice Get user's volume discount for a specific service
     * @param user User address
     * @param serviceName Service name
     * @return discount Discount rate in basis points
     */
    function _getUserVolumeDiscount(
        address user,
        string memory serviceName
    ) internal view returns (uint256 discount) {
        UserUsage memory usage = userUsage[user][serviceName];
        return usage.volumeDiscount;
    }
}
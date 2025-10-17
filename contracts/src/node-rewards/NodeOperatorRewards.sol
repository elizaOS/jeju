// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title NodeOperatorRewards
 * @notice Incentivize and reward node operators for running Jeju RPC infrastructure
 * 
 * Features:
 * - Monthly rewards based on uptime and performance
 * - Staking requirement to prevent Sybil attacks
 * - Geographic diversity bonuses
 * - Request volume tracking
 * - Slashing for misbehavior
 * - DAO governance over parameters
 * 
 * Economics:
 * - Base reward: 100 JEJU/month per node
 * - Uptime multiplier: 0.5x - 2x based on 99%+ uptime
 * - Geographic bonus: +50% for underserved regions
 * - Volume bonus: +0.01 JEJU per 1000 requests served
 * 
 * Example:
 * - Node with 99.5% uptime, serving 1M requests/month in Asia
 * - Base: 100 JEJU
 * - Uptime: 1.5x = 150 JEJU
 * - Volume: 1,000 * 0.01 = 10 JEJU
 * - Geographic: +50% = 80 JEJU
 * - Total: 240 JEJU/month
 */
contract NodeOperatorRewards is Ownable, Pausable, ReentrancyGuard {
    // ============ Structs ============
    
    struct Node {
        address operator;
        string rpcUrl;
        uint256 stakedAmount;
        uint256 registrationTime;
        uint256 totalRewardsClaimed;
        uint256 lastClaimTime;
        bool isActive;
        bool isSlashed;
    }
    
    struct PerformanceData {
        uint256 uptimeScore; // 0-10000 (100.00%)
        uint256 requestsServed;
        uint256 avgResponseTime; // milliseconds
        uint256 lastUpdateTime;
        string geographicRegion; // "North America", "Europe", "Asia", etc.
    }
    
    struct RewardPeriod {
        uint256 startTime;
        uint256 endTime;
        uint256 totalRewardsDistributed;
        uint256 totalNodesActive;
    }
    
    // ============ State Variables ============
    
    IERC20 public immutable rewardToken;
    
    // Node registry
    mapping(bytes32 => Node) public nodes; // nodeId => Node
    mapping(address => bytes32[]) public operatorNodes; // operator => nodeIds
    bytes32[] public allNodeIds;
    
    // Performance tracking
    mapping(bytes32 => PerformanceData) public performance;
    
    // Reward periods (monthly)
    uint256 public currentPeriod;
    mapping(uint256 => RewardPeriod) public periods;
    
    // Parameters
    uint256 public constant MIN_STAKE = 1000 ether; // 1000 JEJU tokens
    uint256 public constant BASE_REWARD_PER_MONTH = 100 ether;
    uint256 public constant UPTIME_THRESHOLD = 9900; // 99.00%
    uint256 public constant PERIOD_DURATION = 30 days;
    
    // Multipliers (in basis points, 10000 = 1x)
    uint256 public uptimeMultiplierMin = 5000; // 0.5x
    uint256 public uptimeMultiplierMax = 20000; // 2x
    uint256 public geographicBonus = 5000; // +50%
    uint256 public volumeBonusPerThousandRequests = 0.01 ether; // 0.01 JEJU per 1000 requests
    
    // Geographic diversity tracking
    mapping(string => uint256) public nodesByRegion;
    
    // Oracle for performance data
    address public performanceOracle;
    
    // ============ Events ============
    
    event NodeRegistered(
        bytes32 indexed nodeId,
        address indexed operator,
        string rpcUrl,
        uint256 stakedAmount
    );
    
    event NodeDeregistered(bytes32 indexed nodeId, address indexed operator);
    
    event PerformanceUpdated(
        bytes32 indexed nodeId,
        uint256 uptimeScore,
        uint256 requestsServed,
        string region
    );
    
    event RewardsClaimed(
        bytes32 indexed nodeId,
        address indexed operator,
        uint256 amount,
        uint256 period
    );
    
    event NodeSlashed(
        bytes32 indexed nodeId,
        address indexed operator,
        uint256 slashAmount,
        string reason
    );
    
    event PeriodStarted(uint256 indexed period, uint256 startTime);
    
    // ============ Errors ============
    
    error InsufficientStake();
    error NodeAlreadyRegistered();
    error NodeNotFound();
    error NodeNotActive();
    error Unauthorized();
    error UnauthorizedOracle();
    error NothingToClaim();
    error TooSoonToClaim();
    error SlashedNode();
    
    // ============ Constructor ============
    
    constructor(
        address _rewardToken,
        address _performanceOracle,
        address initialOwner
    ) Ownable(initialOwner) {
        rewardToken = IERC20(_rewardToken);
        performanceOracle = _performanceOracle;
        
        // Start first period
        currentPeriod = 0;
        periods[0].startTime = block.timestamp;
        emit PeriodStarted(0, block.timestamp);
    }
    
    // ============ Node Registration ============
    
    /**
     * @notice Register a new node and stake tokens
     */
    function registerNode(
        string calldata rpcUrl,
        string calldata geographicRegion,
        uint256 stakeAmount
    ) external whenNotPaused returns (bytes32 nodeId) {
        if (stakeAmount < MIN_STAKE) revert InsufficientStake();
        
        // Generate node ID
        nodeId = keccak256(abi.encodePacked(msg.sender, rpcUrl, block.timestamp));
        
        if (nodes[nodeId].operator != address(0)) revert NodeAlreadyRegistered();
        
        // Transfer stake
        require(
            rewardToken.transferFrom(msg.sender, address(this), stakeAmount),
            "Stake transfer failed"
        );
        
        // Register node
        nodes[nodeId] = Node({
            operator: msg.sender,
            rpcUrl: rpcUrl,
            stakedAmount: stakeAmount,
            registrationTime: block.timestamp,
            totalRewardsClaimed: 0,
            lastClaimTime: block.timestamp,
            isActive: true,
            isSlashed: false
        });
        
        // Initialize performance
        performance[nodeId] = PerformanceData({
            uptimeScore: 10000, // Start at 100%
            requestsServed: 0,
            avgResponseTime: 0,
            lastUpdateTime: block.timestamp,
            geographicRegion: geographicRegion
        });
        
        // Track
        operatorNodes[msg.sender].push(nodeId);
        allNodeIds.push(nodeId);
        nodesByRegion[geographicRegion]++;
        
        emit NodeRegistered(nodeId, msg.sender, rpcUrl, stakeAmount);
    }
    
    /**
     * @notice Deregister node and withdraw stake
     */
    function deregisterNode(bytes32 nodeId) external nonReentrant {
        Node storage node = nodes[nodeId];
        
        if (node.operator == address(0)) revert NodeNotFound();
        if (node.operator != msg.sender) revert Unauthorized();
        if (node.isSlashed) revert SlashedNode();
        
        // Claim any pending rewards first
        if (_calculateRewards(nodeId) > 0) {
            _claimRewards(nodeId);
        }
        
        // Mark inactive
        node.isActive = false;
        nodesByRegion[performance[nodeId].geographicRegion]--;
        
        // Return stake
        require(
            rewardToken.transfer(msg.sender, node.stakedAmount),
            "Stake return failed"
        );
        
        emit NodeDeregistered(nodeId, msg.sender);
    }
    
    // ============ Performance Updates ============
    
    /**
     * @notice Update node performance data (called by oracle)
     */
    function updatePerformance(
        bytes32 nodeId,
        uint256 uptimeScore,
        uint256 requestsServed,
        uint256 avgResponseTime
    ) external {
        if (msg.sender != performanceOracle) revert UnauthorizedOracle();
        
        Node storage node = nodes[nodeId];
        if (node.operator == address(0)) revert NodeNotFound();
        if (!node.isActive) revert NodeNotActive();
        
        PerformanceData storage perf = performance[nodeId];
        
        // Update cumulative requests
        perf.requestsServed = requestsServed;
        
        // Update uptime score (EWMA: 80% old, 20% new)
        perf.uptimeScore = (perf.uptimeScore * 8 + uptimeScore * 2) / 10;
        
        // Update response time
        perf.avgResponseTime = avgResponseTime;
        perf.lastUpdateTime = block.timestamp;
        
        emit PerformanceUpdated(nodeId, perf.uptimeScore, perf.requestsServed, perf.geographicRegion);
    }
    
    // ============ Reward Claiming ============
    
    /**
     * @notice Claim accumulated rewards
     */
    function claimRewards(bytes32 nodeId) external nonReentrant {
        Node storage node = nodes[nodeId];
        
        if (node.operator == address(0)) revert NodeNotFound();
        if (node.operator != msg.sender) revert Unauthorized();
        if (!node.isActive) revert NodeNotActive();
        if (node.isSlashed) revert SlashedNode();
        
        _claimRewards(nodeId);
    }
    
    function _claimRewards(bytes32 nodeId) internal {
        uint256 rewards = _calculateRewards(nodeId);
        
        if (rewards == 0) revert NothingToClaim();
        
        Node storage node = nodes[nodeId];
        
        // Update claim time
        node.lastClaimTime = block.timestamp;
        node.totalRewardsClaimed += rewards;
        
        // Update period stats
        periods[currentPeriod].totalRewardsDistributed += rewards;
        
        // Transfer rewards
        require(
            rewardToken.transfer(node.operator, rewards),
            "Reward transfer failed"
        );
        
        emit RewardsClaimed(nodeId, node.operator, rewards, currentPeriod);
    }
    
    /**
     * @notice Calculate pending rewards for a node
     */
    function calculateRewards(bytes32 nodeId) external view returns (uint256) {
        return _calculateRewards(nodeId);
    }
    
    function _calculateRewards(bytes32 nodeId) internal view returns (uint256) {
        Node storage node = nodes[nodeId];
        PerformanceData storage perf = performance[nodeId];
        
        if (!node.isActive || node.isSlashed) return 0;
        
        // Time elapsed since last claim
        uint256 timeElapsed = block.timestamp - node.lastClaimTime;
        if (timeElapsed < 1 days) return 0; // Minimum 1 day between claims
        
        // Base reward (pro-rated)
        uint256 baseReward = (BASE_REWARD_PER_MONTH * timeElapsed) / PERIOD_DURATION;
        
        // Uptime multiplier
        uint256 uptimeMultiplier = _calculateUptimeMultiplier(perf.uptimeScore);
        uint256 rewardWithUptime = (baseReward * uptimeMultiplier) / 10000;
        
        // Volume bonus
        uint256 volumeBonus = (perf.requestsServed / 1000) * volumeBonusPerThousandRequests;
        
        // Geographic bonus (if region is underrepresented)
        uint256 geoBonus = 0;
        if (_isUnderservedRegion(perf.geographicRegion)) {
            geoBonus = (rewardWithUptime * geographicBonus) / 10000;
        }
        
        return rewardWithUptime + volumeBonus + geoBonus;
    }
    
    function _calculateUptimeMultiplier(uint256 uptimeScore) internal view returns (uint256) {
        if (uptimeScore < UPTIME_THRESHOLD) {
            // Below threshold: linear from 0.5x to 1x
            return uptimeMultiplierMin + 
                   ((10000 - uptimeMultiplierMin) * uptimeScore) / UPTIME_THRESHOLD;
        } else {
            // Above threshold: linear from 1x to 2x
            uint256 excessUptime = uptimeScore - UPTIME_THRESHOLD;
            uint256 maxExcess = 10000 - UPTIME_THRESHOLD; // 1%
            return 10000 + 
                   ((uptimeMultiplierMax - 10000) * excessUptime) / maxExcess;
        }
    }
    
    function _isUnderservedRegion(string memory region) internal view returns (bool) {
        uint256 totalNodes = allNodeIds.length;
        if (totalNodes == 0) return false;
        
        uint256 regionNodes = nodesByRegion[region];
        
        // Region is underserved if it has <15% of total nodes
        return (regionNodes * 100 / totalNodes) < 15;
    }
    
    // ============ Slashing ============
    
    /**
     * @notice Slash a misbehaving node
     */
    function slashNode(
        bytes32 nodeId,
        uint256 slashPercentage,
        string calldata reason
    ) external onlyOwner {
        Node storage node = nodes[nodeId];
        
        if (node.operator == address(0)) revert NodeNotFound();
        
        uint256 slashAmount = (node.stakedAmount * slashPercentage) / 10000;
        node.stakedAmount -= slashAmount;
        node.isSlashed = true;
        node.isActive = false;
        
        // Slash amount goes to treasury (owner)
        require(
            rewardToken.transfer(owner(), slashAmount),
            "Slash transfer failed"
        );
        
        emit NodeSlashed(nodeId, node.operator, slashAmount, reason);
    }
    
    // ============ Period Management ============
    
    /**
     * @notice Start a new reward period
     */
    function startNewPeriod() external {
        if (block.timestamp < periods[currentPeriod].startTime + PERIOD_DURATION) {
            revert TooSoonToClaim();
        }
        
        // Close current period
        periods[currentPeriod].endTime = block.timestamp;
        periods[currentPeriod].totalNodesActive = allNodeIds.length;
        
        // Start new period
        currentPeriod++;
        periods[currentPeriod].startTime = block.timestamp;
        
        emit PeriodStarted(currentPeriod, block.timestamp);
    }
    
    // ============ Admin Functions ============
    
    function setPerformanceOracle(address _newOracle) external onlyOwner {
        performanceOracle = _newOracle;
    }
    
    function setUptimeMultipliers(uint256 _min, uint256 _max) external onlyOwner {
        uptimeMultiplierMin = _min;
        uptimeMultiplierMax = _max;
    }
    
    function setGeographicBonus(uint256 _bonus) external onlyOwner {
        geographicBonus = _bonus;
    }
    
    function setVolumeBonusRate(uint256 _rate) external onlyOwner {
        volumeBonusPerThousandRequests = _rate;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function withdrawRewardTokens(uint256 amount) external onlyOwner {
        require(rewardToken.transfer(owner(), amount), "Withdrawal failed");
    }
    
    // ============ View Functions ============
    
    function getOperatorNodes(address operator) external view returns (bytes32[] memory) {
        return operatorNodes[operator];
    }
    
    function getAllNodes() external view returns (bytes32[] memory) {
        return allNodeIds;
    }
    
    function getNodeInfo(bytes32 nodeId) external view returns (
        Node memory node,
        PerformanceData memory perf,
        uint256 pendingRewards
    ) {
        return (nodes[nodeId], performance[nodeId], _calculateRewards(nodeId));
    }
    
    function getTotalActiveNodes() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < allNodeIds.length; i++) {
            if (nodes[allNodeIds[i]].isActive) {
                count++;
            }
        }
        return count;
    }
}


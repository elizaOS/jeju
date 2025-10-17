// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PriceSource
 * @notice Reads prices on Base L2 and relays them to Jeju L3 via CrossDomainMessenger
 * @dev Deploy this contract on Base L2
 * 
 * Architecture:
 * 1. Reads ETH/USD from Chainlink on Base
 * 2. Reads elizaOS/ETH from Uniswap V3 on Base
 * 3. Sends prices to Jeju via L2CrossDomainMessenger
 * 4. CrossChainPriceRelay on Jeju receives and updates oracle
 */
contract PriceSource is Ownable, Pausable {
    // ============ Constants ============
    
    address public constant L2_CROSS_DOMAIN_MESSENGER = 
        0x4200000000000000000000000000000000000007;
    
    address public constant CHAINLINK_ETH_USD = 
        0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70; // Base mainnet
    
    address public constant UNISWAP_V3_FACTORY = 
        0x33128a8fC17869897dcE68Ed026d694621f6FDfD; // Base mainnet
    
    address public constant WETH = 
        0x4200000000000000000000000000000000000006; // Base WETH
    
    // ============ State Variables ============
    
    address public elizaOSToken;
    address public crossChainRelayOnJeju;
    address public priceUpdater;
    
    uint256 public lastUpdateTime;
    uint256 public updateCount;
    uint256 public constant MIN_UPDATE_INTERVAL = 5 minutes;
    uint256 public constant MAX_PRICE_DEVIATION_PCT = 50; // 50% max change
    
    uint256 private lastETHPrice;
    uint256 private lastElizaPrice;
    
    // ============ Events ============
    
    event PricesRelayed(
        uint256 ethPrice,
        uint256 elizaPrice,
        uint256 timestamp,
        bytes32 messageHash
    );
    
    event PriceUpdaterSet(address indexed newUpdater);
    event ElizaOSTokenSet(address indexed newToken);
    event CrossChainRelaySet(address indexed newRelay);
    
    // ============ Errors ============
    
    error UpdateTooSoon();
    error PriceDeviationTooLarge();
    error UnauthorizedUpdater();
    error InvalidPrice();
    error NoPoolFound();
    
    // ============ Constructor ============
    
    constructor(
        address _elizaOSToken,
        address _crossChainRelayOnJeju,
        address _priceUpdater,
        address initialOwner
    ) Ownable(initialOwner) {
        elizaOSToken = _elizaOSToken;
        crossChainRelayOnJeju = _crossChainRelayOnJeju;
        priceUpdater = _priceUpdater;
    }
    
    // ============ Main Function ============
    
    /**
     * @notice Update prices and relay to Jeju
     * @dev Can be called by priceUpdater or owner
     */
    function updateAndRelay() external whenNotPaused {
        if (msg.sender != priceUpdater && msg.sender != owner()) {
            revert UnauthorizedUpdater();
        }
        
        if (block.timestamp < lastUpdateTime + MIN_UPDATE_INTERVAL) {
            revert UpdateTooSoon();
        }
        
        // 1. Read ETH/USD from Chainlink
        uint256 ethPrice = _readChainlink();
        
        // 2. Read elizaOS/USD from Uniswap
        uint256 elizaPrice = _readUniswapV3();
        
        // 3. Validate prices
        _validatePrices(ethPrice, elizaPrice);
        
        // 4. Send via CrossDomainMessenger
        bytes memory message = abi.encodeWithSignature(
            "receivePriceUpdate(uint256,uint256)",
            ethPrice,
            elizaPrice
        );
        
        // Call CrossDomainMessenger to send message to Jeju
        (bool success, bytes memory returnData) = L2_CROSS_DOMAIN_MESSENGER.call(
            abi.encodeWithSignature(
                "sendMessage(address,bytes,uint32)",
                crossChainRelayOnJeju,
                message,
                uint32(1000000) // Gas limit for execution on Jeju
            )
        );
        
        require(success, "CrossDomainMessenger call failed");
        
        // Update state
        lastETHPrice = ethPrice;
        lastElizaPrice = elizaPrice;
        lastUpdateTime = block.timestamp;
        updateCount++;
        
        // Extract message hash from return data (if available)
        bytes32 messageHash = returnData.length >= 32 
            ? abi.decode(returnData, (bytes32))
            : bytes32(0);
        
        emit PricesRelayed(ethPrice, elizaPrice, block.timestamp, messageHash);
    }
    
    // ============ Price Reading Functions ============
    
    /**
     * @notice Read ETH/USD price from Chainlink
     * @return ethPrice Price with 8 decimals (e.g., 324567000000 = $3,245.67)
     */
    function _readChainlink() internal view returns (uint256 ethPrice) {
        // Chainlink AggregatorV3Interface
        (bool success, bytes memory data) = CHAINLINK_ETH_USD.staticcall(
            abi.encodeWithSignature("latestRoundData()")
        );
        
        require(success, "Chainlink call failed");
        
        (
            ,
            int256 answer,
            ,
            uint256 updatedAt,
            
        ) = abi.decode(data, (uint80, int256, uint256, uint256, uint80));
        
        // Check staleness (Chainlink ETH/USD updates ~every hour)
        require(block.timestamp - updatedAt < 2 hours, "Chainlink price stale");
        require(answer > 0, "Invalid Chainlink price");
        
        // Chainlink uses 8 decimals
        ethPrice = uint256(answer);
    }
    
    /**
     * @notice Read elizaOS/USD price from Uniswap V3
     * @return elizaPrice Price with 8 decimals
     */
    function _readUniswapV3() internal view returns (uint256 elizaPrice) {
        // Get factory
        address factory = UNISWAP_V3_FACTORY;
        
        // Try different fee tiers (0.05%, 0.3%, 1%)
        uint24[3] memory feeTiers = [uint24(500), uint24(3000), uint24(10000)];
        
        for (uint256 i = 0; i < feeTiers.length; i++) {
            address pool = _getPool(factory, elizaOSToken, WETH, feeTiers[i]);
            
            if (pool == address(0)) continue;
            
            // Read pool price
            uint256 price = _getPoolPrice(pool);
            
            if (price > 0) {
                // Convert to USD using ETH price
                uint256 ethPrice = lastETHPrice > 0 ? lastETHPrice : _readChainlink();
                
                // elizaOS/ETH × ETH/USD = elizaOS/USD
                // Both are 8 decimals, result should be 8 decimals
                elizaPrice = (price * ethPrice) / 1e8;
                
                if (elizaPrice > 0) {
                    return elizaPrice;
                }
            }
        }
        
        revert NoPoolFound();
    }
    
    function _getPool(
        address factory,
        address tokenA,
        address tokenB,
        uint24 fee
    ) internal view returns (address pool) {
        (bool success, bytes memory data) = factory.staticcall(
            abi.encodeWithSignature(
                "getPool(address,address,uint24)",
                tokenA,
                tokenB,
                fee
            )
        );
        
        if (success && data.length >= 32) {
            pool = abi.decode(data, (address));
        }
    }
    
    function _getPoolPrice(address pool) internal view returns (uint256 price) {
        // Get slot0 from pool
        (bool success, bytes memory data) = pool.staticcall(
            abi.encodeWithSignature("slot0()")
        );
        
        if (!success) return 0;
        
        (uint160 sqrtPriceX96, , , , , , ) = abi.decode(
            data,
            (uint160, int24, uint16, uint16, uint16, uint8, bool)
        );
        
        if (sqrtPriceX96 == 0) return 0;
        
        // Get token order
        (bool success0, bytes memory data0) = pool.staticcall(
            abi.encodeWithSignature("token0()")
        );
        if (!success0) return 0;
        
        address token0 = abi.decode(data0, (address));
        
        // Calculate price from sqrtPriceX96
        // price = (sqrtPriceX96 / 2^96)^2
        // Using uint256 to avoid overflow: (sqrtPriceX96^2) / (2^192)
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        
        // Adjust for token order
        if (token0 == elizaOSToken) {
            // elizaOS is token0, price is in WETH per elizaOS
            // Invert: (2^192) / priceX192
            // Scale to 8 decimals: result * 1e8 / 2^192
            price = (1e8 * (2 ** 192)) / priceX192;
        } else {
            // elizaOS is token1, price is already elizaOS per WETH
            // Scale to 8 decimals: result * 1e8 / 2^192
            price = (priceX192 * 1e8) / (2 ** 192);
        }
        
        // Note: This assumes both tokens have 18 decimals
        // For production, query decimals and adjust
    }
    
    // ============ Validation ============
    
    function _validatePrices(uint256 ethPrice, uint256 elizaPrice) internal view {
        // ETH should be between $500 and $10,000
        if (ethPrice < 50000000000 || ethPrice > 1000000000000) {
            revert InvalidPrice();
        }
        
        // Check for large deviations (anti-manipulation)
        if (lastETHPrice > 0) {
            uint256 ethChange = ethPrice > lastETHPrice
                ? ((ethPrice - lastETHPrice) * 100) / lastETHPrice
                : ((lastETHPrice - ethPrice) * 100) / lastETHPrice;
            
            if (ethChange > MAX_PRICE_DEVIATION_PCT) {
                revert PriceDeviationTooLarge();
            }
        }
        
        if (lastElizaPrice > 0) {
            uint256 elizaChange = elizaPrice > lastElizaPrice
                ? ((elizaPrice - lastElizaPrice) * 100) / lastElizaPrice
                : ((lastElizaPrice - elizaPrice) * 100) / lastElizaPrice;
            
            if (elizaChange > MAX_PRICE_DEVIATION_PCT) {
                revert PriceDeviationTooLarge();
            }
        }
    }
    
    // ============ Admin Functions ============
    
    function setPriceUpdater(address _newUpdater) external onlyOwner {
        require(_newUpdater != address(0), "Invalid updater");
        priceUpdater = _newUpdater;
        emit PriceUpdaterSet(_newUpdater);
    }
    
    function setElizaOSToken(address _newToken) external onlyOwner {
        require(_newToken != address(0), "Invalid token");
        elizaOSToken = _newToken;
        emit ElizaOSTokenSet(_newToken);
    }
    
    function setCrossChainRelay(address _newRelay) external onlyOwner {
        require(_newRelay != address(0), "Invalid relay");
        crossChainRelayOnJeju = _newRelay;
        emit CrossChainRelaySet(_newRelay);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ View Functions ============
    
    function getLastPrices() external view returns (
        uint256 ethPrice,
        uint256 elizaPrice,
        uint256 timestamp
    ) {
        return (lastETHPrice, lastElizaPrice, lastUpdateTime);
    }
    
    /**
     * @notice Preview what prices would be relayed (without actually relaying)
     */
    function previewPrices() external view returns (
        uint256 ethPrice,
        uint256 elizaPrice
    ) {
        ethPrice = _readChainlink();
        elizaPrice = _readUniswapV3();
    }
}


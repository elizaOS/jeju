// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title SimpleGame
 * @author Jeju Network
 * @notice Example game contract demonstrating paymaster integration for app developers
 * @dev Shows how applications can earn revenue automatically when users interact
 *      with their contracts using the paymaster system. No special contract logic needed!
 * 
 * How It Works:
 * 1. Deploy this contract with a revenue wallet address
 * 2. Users interact with game functions (makeMove, resetScore, etc.)
 * 3. Users include your revenue wallet in their UserOp paymasterAndData
 * 4. Paymaster sponsors the transaction and collects elizaOS from user
 * 5. FeeDistributor automatically credits 50% of fees to your revenue wallet
 * 6. You claim earnings from FeeDistributor anytime
 * 
 * Integration Pattern:
 * - NO changes to your existing contract logic required
 * - NO token handling in your contract
 * - NO special modifiers or checks needed
 * - Just deploy and set a revenue wallet address
 * - Users' wallets handle the paymaster integration
 * 
 * Revenue Flow:
 * User Transaction → Paymaster Sponsors → Collects elizaOS → FeeDistributor
 * → 50% to App Revenue Wallet → Claimable Anytime
 * 
 * Frontend Integration:
 * - Tell users to include your revenue wallet in paymasterAndData
 * - SDK/wallet handles the rest automatically
 * - Example: paymasterAndData = <paymaster><gasLimits><revenueWallet>
 * 
 * @custom:example This is a minimal game for demonstration. Your app can be anything:
 *                 DeFi protocol, NFT marketplace, social network, etc.
 */
contract SimpleGame {
    // ============ State ============
    
    /// @notice Wallet address that receives 50% of transaction fees
    /// @dev This address is included in paymasterAndData by users
    address public revenueWallet;
    
    /// @notice Player scores
    mapping(address => uint256) public scores;
    
    /// @notice Total number of plays across all players
    uint256 public totalPlays;
    
    // ============ Events ============
    
    event PlayerMoved(address indexed player, uint256 newScore);
    event RevenueWalletUpdated(address indexed newWallet);
    
    // ============ Constructor ============
    
    /**
     * @notice Deploy game with revenue wallet for fee collection
     * @param _revenueWallet Address that will receive 50% of transaction fees
     * @dev This wallet address should be included in paymasterAndData by users
     */
    constructor(address _revenueWallet) {
        require(_revenueWallet != address(0), "Invalid wallet");
        revenueWallet = _revenueWallet;
    }
    
    // ============ Game Functions ============
    
    /**
     * @notice Make a game move (increments player score)
     * @dev Standard function - no special paymaster logic needed in contract!
     *      Revenue earning happens automatically when users include revenueWallet
     *      in their UserOp paymasterAndData field.
     * 
     * User Flow:
     * 1. User calls this function via AA wallet (UserOp)
     * 2. UserOp includes: paymasterAndData = <paymaster><gasLimits><revenueWallet>
     * 3. Paymaster sponsors gas using LP ETH
     * 4. Paymaster collects elizaOS from user
     * 5. FeeDistributor credits 50% to revenueWallet
     * 6. Your function executes normally
     * 
     * @custom:integration Your frontend must encode revenueWallet in paymasterAndData
     */
    function makeMove() external {
        scores[msg.sender] += 1;
        totalPlays += 1;
        
        emit PlayerMoved(msg.sender, scores[msg.sender]);
        
        // That's it! You earned revenue from this transaction.
        // The paymaster system automatically credits revenueWallet.
    }
    
    /**
     * @notice Reset player's score to zero
     * @dev Another example function earning revenue when called via paymaster
     */
    function resetScore() external {
        scores[msg.sender] = 0;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get score for a specific player
     * @param player Address of the player
     * @return Current score
     */
    function getScore(address player) external view returns (uint256) {
        return scores[player];
    }
    
    /**
     * @notice Get the revenue wallet address
     * @return Address that receives transaction fee revenue
     * @dev Frontends should fetch this and include it in paymasterAndData
     */
    function getRevenueWallet() external view returns (address) {
        return revenueWallet;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update the revenue wallet address
     * @param _newWallet New address to receive fee revenue
     * @dev Only current revenue wallet can change it (ownership pattern)
     * @custom:security Ensure new wallet address is controlled by you
     */
    function setRevenueWallet(address _newWallet) external {
        require(msg.sender == revenueWallet, "Only revenue wallet can change");
        require(_newWallet != address(0), "Invalid wallet");
        
        revenueWallet = _newWallet;
        emit RevenueWalletUpdated(_newWallet);
    }
    
    /**
     * @notice Returns the contract version
     * @return Version string in semver format
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}


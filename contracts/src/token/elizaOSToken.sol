// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;    

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title elizaOS Token
 * @author Jeju Network
 * @notice Standard ERC-20 token used as the fee payment token in the Jeju ecosystem
 * @dev This token is used by the LiquidityPaymaster system where users pay transaction fees 
 *      in elizaOS tokens instead of ETH. The paymaster converts these tokens to ETH using 
 *      liquidity provider pools.
 * 
 * Security Features:
 * - Owner-controlled minting for supply management
 * - Supply cap at 10 billion tokens (10x initial supply)
 * - Standard OpenZeppelin ERC20 implementation
 * - Initial supply: 1 billion tokens
 * 
 * Integration:
 * - Users must approve the paymaster contract to spend elizaOS tokens
 * - Tokens are collected by paymaster after transaction execution
 * - Fees are distributed: 50% to apps, 50% to liquidity providers
 */
contract elizaOSToken is ERC20, Ownable {
    /// @notice Initial token supply (1 billion tokens with 18 decimals)
    uint256 private constant INITIAL_SUPPLY = 1_000_000_000 * 10**18;
    
    /// @notice Maximum total supply cap (10 billion tokens with 18 decimals)
    /// @dev Prevents unlimited inflation, set at 10x initial supply for long-term growth
    uint256 public constant MAX_SUPPLY = 10_000_000_000 * 10**18;
    
    // ============ Errors ============
    
    error MaxSupplyExceeded();

    /**
     * @notice Constructs the elizaOS token and mints initial supply
     * @param initialOwner Address that will receive initial supply and minting rights
     * @dev Mints 1 billion tokens to the initial owner immediately upon deployment
     */
    constructor(address initialOwner) ERC20("elizaOS Token", "elizaOS") Ownable(initialOwner) {
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    /**
     * @notice Mints new tokens to a specified address
     * @param to Address to receive the newly minted tokens
     * @param amount Number of tokens to mint (in wei, 18 decimals)
     * @dev Only callable by contract owner. Use for treasury operations, rewards, or ecosystem growth.
     *      Enforces MAX_SUPPLY cap to prevent unlimited inflation.
     * @custom:security Minting is capped at 10 billion total supply
     */
    function mint(address to, uint256 amount) public onlyOwner {
        if (totalSupply() + amount > MAX_SUPPLY) revert MaxSupplyExceeded();
        _mint(to, amount);
    }
    
    /**
     * @notice Returns the contract version
     * @return Version string in semver format
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}

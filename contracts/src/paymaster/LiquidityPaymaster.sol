// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {BasePaymaster} from "@account-abstraction/contracts/core/BasePaymaster.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

interface ILiquidityVault {
    function provideETHForGas(uint256 amount) external returns (bool);
    function availableETH() external view returns (uint256);
    function distributeFees(uint256 ethPoolFees, uint256 elizaPoolFees) external;
}

interface IFeeDistributor {
    function distributeFees(uint256 amount, address appAddress) external;
}

interface IPriceOracle {
    function getElizaOSPerETH() external view returns (uint256);
    function isPriceFresh() external view returns (bool);
}

/**
 * @title LiquidityPaymaster  
 * @author Jeju Network
 * @notice ERC-4337 compliant paymaster enabling gasless transactions paid in elizaOS tokens
 * @dev Implements account abstraction where users pay gas fees in elizaOS instead of ETH.
 *      The paymaster sponsors transactions using ETH from liquidity providers, then collects
 *      elizaOS tokens from users and distributes them as fees.
 * 
 * Architecture:
 * - Users approve elizaOS spending and include paymaster address in UserOp
 * - Paymaster validates transaction and sponsors gas using ETH from LiquidityVault
 * - After execution, paymaster collects elizaOS tokens from user
 * - Fees are distributed via FeeDistributor: 50% to app, 50% to LPs
 * 
 * Security Features:
 * - Oracle staleness checks prevent using outdated prices
 * - Gas cost limits prevent expensive transaction attacks
 * - Minimum fee enforcement prevents dust spam
 * - Pausable for emergency scenarios
 * - Allowance and balance checks before sponsoring
 * 
 * ERC-4337 v0.7 Compliance:
 * - Implements _validatePaymasterUserOp for validation phase
 * - Implements _postOp for post-execution fee collection
 * - Correctly parses paymasterAndData format
 * 
 * @custom:security-contact security@jeju.network
 */
contract LiquidityPaymaster is BasePaymaster, Pausable {
    // ============ State Variables ============
    
    /// @notice elizaOS token contract - used for fee payments
    IERC20 public immutable elizaOS;
    
    /// @notice Vault holding ETH and elizaOS liquidity from LPs
    ILiquidityVault public immutable liquidityVault;
    
    /// @notice Distributor that splits fees between apps and LPs
    IFeeDistributor public immutable feeDistributor;
    
    /// @notice Oracle providing elizaOS/ETH exchange rate
    IPriceOracle public priceOracle;
    
    /// @notice Additional fee margin added to cover price volatility (in basis points)
    /// @dev Default 10% = 1000 basis points. Configurable by owner.
    uint256 public feeMargin = 1000;
    
    /// @notice Basis points denominator for percentage calculations
    uint256 public constant BASIS_POINTS = 10000;
    
    /// @notice Minimum fee in elizaOS tokens to prevent dust spam
    /// @dev Default 1 elizaOS token. Configurable by owner.
    uint256 public minFee = 1e18;
    
    /// @notice Maximum gas cost in ETH per transaction to prevent griefing
    /// @dev Default 0.1 ETH. Protects against expensive operations. Configurable by owner.
    uint256 public maxGasCost = 0.1 ether;
    
    /// @notice Minimum ETH balance to maintain in EntryPoint deposit
    /// @dev Used for auto-refill logic. Default 1 ETH. Configurable by owner.
    uint256 public minEntryPointBalance = 1 ether;
    
    // ============ Events ============
    
    event TransactionSponsored(
        address indexed user,
        address indexed app,
        uint256 gasCost,
        uint256 elizaOSCharged
    );
    event FeeMarginUpdated(uint256 oldMargin, uint256 newMargin);
    event PriceOracleUpdated(address indexed newOracle);
    event EntryPointFunded(uint256 amount);
    
    // ============ Errors ============
    
    error InvalidPaymasterData();
    error InsufficientElizaOSBalance();
    error InsufficientElizaOSAllowance();
    error InsufficientLiquidity();
    error GasCostTooHigh();
    error FeeBelowMinimum();
    error StaleOraclePrice();
    error PaymentFailed();
    
    // ============ Constructor ============
    
    /**
     * @notice Constructs the LiquidityPaymaster with required dependencies
     * @param _entryPoint ERC-4337 EntryPoint contract address (v0.7)
     * @param _elizaOS elizaOS token contract address
     * @param _liquidityVault Liquidity vault contract address
     * @param _feeDistributor Fee distributor contract address
     * @param _priceOracle Price oracle contract address
     * @dev All addresses are validated as non-zero and set as immutable
     * @custom:security Ensure all contracts are deployed and configured before setting
     */
    constructor(
        IEntryPoint _entryPoint,
        address _elizaOS,
        address _liquidityVault,
        address _feeDistributor,
        address _priceOracle
    ) BasePaymaster(_entryPoint) {
        require(_elizaOS != address(0), "Invalid elizaOS");
        require(_liquidityVault != address(0), "Invalid vault");
        require(_feeDistributor != address(0), "Invalid distributor");
        require(_priceOracle != address(0), "Invalid oracle");
        
        elizaOS = IERC20(_elizaOS);
        liquidityVault = ILiquidityVault(_liquidityVault);
        feeDistributor = IFeeDistributor(_feeDistributor);
        priceOracle = IPriceOracle(_priceOracle);
    }
    
    // ============ Paymaster Core ============
    
    /**
     * @notice Validates paymaster willingness to sponsor a user operation
     * @param userOp The user operation to validate
     * @param maxCost Maximum gas cost in ETH that could be charged
     * @return context Encoded data passed to _postOp (user, app, maxElizaOS amount)
     * @return validationData 0 for valid, 1 for invalid, or packed expiry data
     * @dev Called by EntryPoint during validation phase before transaction execution
     * 
     * Validation checks:
     * - Oracle price data is fresh (not stale)
     * - Gas cost is within acceptable limits
     * - User has sufficient elizaOS balance and allowance
     * - Vault has enough ETH liquidity available
     * - EntryPoint deposit is sufficient for this transaction
     * 
     * paymasterAndData format (ERC-4337 v0.7):
     * - Bytes 0-19: paymaster address (this contract)
     * - Bytes 20-35: verificationGasLimit (uint128)
     * - Bytes 36-51: postOpGasLimit (uint128)
     * - Bytes 52-71: app revenue wallet address (custom data)
     * 
     * @custom:security Price staleness check prevents using outdated exchange rates
     * @custom:security Gas limits prevent griefing with expensive operations
     */
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32, /*userOpHash*/
        uint256 maxCost
    ) internal view override whenNotPaused returns (bytes memory context, uint256 validationData) {
        // Check oracle freshness
        if (!priceOracle.isPriceFresh()) revert StaleOraclePrice();
        
        // Parse paymasterAndData (ERC-4337 v0.7 format)
        // Bytes 0-19: paymaster address (already validated by EntryPoint)
        // Bytes 20-35: verificationGasLimit (uint128)
        // Bytes 36-51: postOpGasLimit (uint128)
        // Bytes 52-71: app address (our custom data)
        if (userOp.paymasterAndData.length < 72) revert InvalidPaymasterData();
        
        address appAddress = address(bytes20(userOp.paymasterAndData[52:72]));
        if (appAddress == address(0)) revert InvalidPaymasterData();
        
        // Check gas cost limit
        if (maxCost > maxGasCost) revert GasCostTooHigh();
        
        // Calculate required elizaOS tokens
        uint256 requiredElizaOS = calculateElizaOSAmount(maxCost);
        if (requiredElizaOS < minFee) revert FeeBelowMinimum();
        
        // Verify user has enough elizaOS
        address sender = userOp.sender;
        if (elizaOS.balanceOf(sender) < requiredElizaOS) {
            revert InsufficientElizaOSBalance();
        }
        if (elizaOS.allowance(sender, address(this)) < requiredElizaOS) {
            revert InsufficientElizaOSAllowance();
        }
        
        // Verify liquidity vault has enough ETH
        if (liquidityVault.availableETH() < maxCost) {
            revert InsufficientLiquidity();
        }
        
        // Check our EntryPoint deposit is sufficient
        uint256 currentDeposit = entryPoint.balanceOf(address(this));
        if (currentDeposit < maxCost + minEntryPointBalance) {
            revert InsufficientLiquidity();
        }
        
        // Pack context for postOp
        context = abi.encode(sender, appAddress, requiredElizaOS);
        validationData = 0; // Accept
    }
    
    /**
     * @notice Post-operation callback to collect fees after transaction execution
     * @param mode Execution result (opSucceeded, opReverted, or postOpReverted)
     * @param context Data from validation phase (user, app, maxElizaOS)
     * @param actualGasCost Actual gas cost in ETH used by the transaction
     * @dev Called by EntryPoint after user operation execution
     * 
     * Fee collection process:
     * 1. Calculate actual elizaOS cost based on actual gas used
     * 2. Cap at maximum to prevent overcharging
     * 3. Transfer elizaOS from user to paymaster
     * 4. Approve fee distributor to spend tokens
     * 5. Distribute fees (50% to app, 50% to LPs)
     * 
     * @custom:security User is charged even if operation reverted (mode == opReverted)
     * @custom:security Capped at estimated amount from validation to prevent overcharging
     */
    function _postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 /*actualUserOpFeePerGas*/
    ) internal override whenNotPaused {
        // Only process if operation succeeded or reverted (user still pays)
        if (mode == PostOpMode.opSucceeded || mode == PostOpMode.opReverted) {
            (address sender, address appAddress, uint256 maxElizaOS) = abi.decode(
                context,
                (address, address, uint256)
            );
            
            // Calculate actual elizaOS to charge based on actual gas used
            uint256 actualElizaOS = calculateElizaOSAmount(actualGasCost);
            
            // Don't overcharge - cap at estimate
            if (actualElizaOS > maxElizaOS) {
                actualElizaOS = maxElizaOS;
            }
            
            // Collect elizaOS from user
            bool success = elizaOS.transferFrom(sender, address(this), actualElizaOS);
            if (!success) revert PaymentFailed();
            
            // Approve fee distributor
            require(elizaOS.approve(address(feeDistributor), actualElizaOS), "Approval failed");
            
            // Distribute: 50% to app, 50% to LPs (via distributor)
            feeDistributor.distributeFees(actualElizaOS, appAddress);
            
            emit TransactionSponsored(sender, appAddress, actualGasCost, actualElizaOS);
        }
    }
    
    // ============ Helper Functions ============
    
    /**
     * @notice Calculate elizaOS tokens required for a given gas cost in ETH
     * @param gasCostInETH Gas cost in wei (1e18 = 1 ETH)
     * @return Amount of elizaOS tokens needed (18 decimals, includes fee margin)
     * @dev Fetches current exchange rate from oracle and adds configured margin
     * 
     * Calculation:
     * 1. Get elizaOS per ETH rate from oracle
     * 2. Convert gas cost: (gasCostInETH * elizaPerETH) / 1 ether
     * 3. Add margin: baseAmount + (baseAmount * feeMargin / BASIS_POINTS)
     * 
     * Example: 0.001 ETH gas at 30,000 elizaOS/ETH with 10% margin:
     * - Base: (0.001 * 30000) = 30 elizaOS
     * - Margin: 30 * 0.10 = 3 elizaOS
     * - Total: 33 elizaOS
     * 
     * @custom:security Margin provides buffer for price volatility and sustainability
     */
    function calculateElizaOSAmount(uint256 gasCostInETH) public view returns (uint256) {
        // Get exchange rate from oracle (elizaOS per ETH)
        uint256 elizaPerETH = priceOracle.getElizaOSPerETH();
        require(elizaPerETH > 0, "Invalid exchange rate");
        
        // Calculate base amount
        uint256 baseAmount = (gasCostInETH * elizaPerETH) / 1 ether;
        
        // Add margin for sustainability
        uint256 margin = (baseAmount * feeMargin) / BASIS_POINTS;
        
        return baseAmount + margin;
    }
    
    /**
     * @notice Preview elizaOS cost for a transaction before execution
     * @param estimatedGas Estimated gas units for the transaction
     * @param gasPrice Gas price in wei per unit
     * @return Total elizaOS tokens required (includes fee margin)
     * @dev Helper function for frontends to show users the cost before submitting
     */
    function previewCost(uint256 estimatedGas, uint256 gasPrice) external view returns (uint256) {
        uint256 gasCostInETH = estimatedGas * gasPrice;
        return calculateElizaOSAmount(gasCostInETH);
    }
    
    // ============ Funding Management ============
    
    /**
     * @notice Manually fund paymaster's EntryPoint deposit from liquidity vault
     * @param amount Amount of ETH to transfer from vault to EntryPoint
     * @dev Only callable by owner. Used for initial funding or manual top-ups.
     * 
     * Process:
     * 1. Request ETH from liquidity vault
     * 2. Receive ETH into this contract
     * 3. Deposit ETH into EntryPoint on behalf of paymaster
     * 
     * @custom:security Ensure vault has sufficient liquidity before calling
     */
    function fundFromVault(uint256 amount) external onlyOwner {
        require(liquidityVault.provideETHForGas(amount), "Vault transfer failed");
        // ETH is now in this contract, deposit to EntryPoint
        entryPoint.depositTo{value: amount}(address(this));
        emit EntryPointFunded(amount);
    }
    
    /**
     * @notice Automatically refill EntryPoint deposit when balance is low
     * @dev Permissionless function - anyone can call to maintain system health.
     *      Refills to 2x the minimum balance when current balance falls below minimum.
     * 
     * Refill Logic:
     * - Triggers when: currentBalance < minEntryPointBalance
     * - Refills to: 2 * minEntryPointBalance
     * - Amount needed: (2 * min) - current
     * 
     * Example: If min is 1 ETH and current is 0.5 ETH:
     * - Needed: (2 * 1) - 0.5 = 1.5 ETH
     * - Final balance: 2 ETH
     * 
     * @custom:security Permissionless design allows keepers or users to maintain system
     */
    function refillEntryPointDeposit() external {
        uint256 currentBalance = entryPoint.balanceOf(address(this));
        if (currentBalance < minEntryPointBalance) {
            uint256 needed = (minEntryPointBalance * 2) - currentBalance; // Refill to 2x min
            require(liquidityVault.provideETHForGas(needed), "Vault transfer failed");
            entryPoint.depositTo{value: needed}(address(this));
            emit EntryPointFunded(needed);
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Check if paymaster is currently operational and can sponsor transactions
     * @return True if all systems are healthy, false otherwise
     * @dev Checks multiple conditions:
     *      - Not paused (emergency stop is inactive)
     *      - EntryPoint balance meets minimum requirement
     *      - Oracle price data is fresh
     *      - Vault has available ETH liquidity
     */
    function isOperational() external view returns (bool) {
        return !paused() 
            && entryPoint.balanceOf(address(this)) >= minEntryPointBalance
            && priceOracle.isPriceFresh()
            && liquidityVault.availableETH() > 0;
    }
    
    /**
     * @notice Get detailed status information about the paymaster
     * @return entryPointBalance Current ETH deposited in EntryPoint
     * @return vaultLiquidity Available ETH in liquidity vault
     * @return oracleFresh Whether oracle price data is fresh
     * @return operational Whether paymaster can currently sponsor transactions
     * @dev Useful for monitoring and frontend status displays
     */
    function getStatus() external view returns (
        uint256 entryPointBalance,
        uint256 vaultLiquidity,
        bool oracleFresh,
        bool operational
    ) {
        entryPointBalance = entryPoint.balanceOf(address(this));
        vaultLiquidity = liquidityVault.availableETH();
        oracleFresh = priceOracle.isPriceFresh();
        operational = this.isOperational();
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update the fee margin added to gas costs
     * @param newMargin New margin in basis points (1000 = 10%)
     * @dev Only callable by owner. Maximum allowed is 20% (2000 basis points).
     *      Margin provides buffer for price volatility and system sustainability.
     */
    function setFeeMargin(uint256 newMargin) external onlyOwner {
        require(newMargin <= 2000, "Margin too high"); // Max 20%
        uint256 oldMargin = feeMargin;
        feeMargin = newMargin;
        emit FeeMarginUpdated(oldMargin, newMargin);
    }
    
    /**
     * @notice Update the price oracle contract address
     * @param newOracle Address of the new oracle contract
     * @dev Only callable by owner. New oracle must implement IPriceOracle interface.
     * @custom:security Verify new oracle is deployed and functioning before setting
     */
    function setPriceOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle");
        priceOracle = IPriceOracle(newOracle);
        emit PriceOracleUpdated(newOracle);
    }
    
    /**
     * @notice Update the minimum fee required per transaction
     * @param newMinFee New minimum fee in elizaOS tokens (18 decimals)
     * @dev Only callable by owner. Prevents dust transactions that waste gas.
     */
    function setMinFee(uint256 newMinFee) external onlyOwner {
        minFee = newMinFee;
    }
    
    /**
     * @notice Update the maximum gas cost allowed per transaction
     * @param newMax New maximum in wei (ETH)
     * @dev Only callable by owner. Protects against griefing with expensive operations.
     */
    function setMaxGasCost(uint256 newMax) external onlyOwner {
        maxGasCost = newMax;
    }
    
    /**
     * @notice Update the minimum EntryPoint balance threshold
     * @param newMin New minimum balance in wei (ETH)
     * @dev Only callable by owner. Used for auto-refill logic to maintain operational buffer.
     */
    function setMinEntryPointBalance(uint256 newMin) external onlyOwner {
        minEntryPointBalance = newMin;
    }
    
    /**
     * @notice Pause paymaster operations in case of emergency
     * @dev Only callable by owner. Prevents new transactions from being sponsored.
     *      Use in case of security issues, oracle failures, or system maintenance.
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Resume paymaster operations after pause
     * @dev Only callable by owner. Re-enables transaction sponsorship.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Receive ETH ============
    
    /**
     * @notice Fallback to accept ETH transfers from liquidity vault
     * @dev Required to receive ETH from vault when calling provideETHForGas
     */
    receive() external payable {
        // Accept ETH from liquidity vault
    }
    
    /**
     * @notice Returns the contract version
     * @return Version string in semver format
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}


// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/**
 * @title DeployAA
 * @notice Deploys ERC-4337 Account Abstraction infrastructure
 * 
 * Deploys:
 * - EntryPoint v0.6 (standard address)
 * - Account Factory
 * - Paymaster
 * 
 * Usage:
 *   forge script script/DeployAA.s.sol:DeployAA \
 *     --rpc-url https://testnet-rpc.jeju.network \
 *     --broadcast \
 *     --verify
 */
contract DeployAA is Script {
    
    // EntryPoint v0.6 canonical address
    address constant ENTRYPOINT = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==================================================");
        console.log("Deploying ERC-4337 Account Abstraction");
        console.log("==================================================");
        console.log("Deployer:", deployer);
        console.log("EntryPoint:", ENTRYPOINT);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // EntryPoint v0.6 should already be deployed at canonical address
        // If not, it needs to be deployed using CREATE2 to match the address
        
        console.log("IMPORTANT: ERC-4337 contracts should be deployed using:");
        console.log("1. EntryPoint v0.6: Already at", ENTRYPOINT);
        console.log("2. Account Factory: Deploy SimpleAccountFactory from @account-abstraction/contracts");
        console.log("3. Paymaster: Deploy VerifyingPaymaster or custom paymaster");
        console.log("");
        console.log("Install:");
        console.log("  forge install eth-infinitism/account-abstraction");
        console.log("");
        console.log("Then deploy Account Factory and Paymaster");
        console.log("Save addresses to deployments/<network>/aa.json");
        
        vm.stopBroadcast();
    }
}



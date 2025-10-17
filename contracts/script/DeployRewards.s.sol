// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import {NodeOperatorRewards} from "../src/node-rewards/NodeOperatorRewards.sol";
import {elizaOSToken} from "../src/token/elizaOSToken.sol";

/**
 * @title Deploy Node Operator Rewards
 * @notice Deploys the rewards contract for incentivizing node operators
 */
contract DeployRewards is Script {
    function run() external returns (address rewardsContract, address tokenAddress) {
        uint256 deployerPrivateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(deployerPrivateKey);
        string memory network = vm.envOr("NETWORK", string("localnet"));
        
        console.log("============================================================");
        console.log("Deploying Node Operator Rewards System");
        console.log("============================================================");
        console.log("Network:", network);
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy or use existing token
        address existingToken = vm.envOr("REWARD_TOKEN_ADDRESS", address(0));
        
        if (existingToken == address(0)) {
            console.log("\n[1/2] Deploying Reward Token (elizaOS)...");
            elizaOSToken token = new elizaOSToken(deployer);
            tokenAddress = address(token);
            console.log("   Token deployed:", tokenAddress);
            
            // Mint initial supply for rewards pool
            uint256 rewardsPool = 1_000_000 ether; // 1M JEJU for rewards
            console.log("   Minting rewards pool:", rewardsPool / 1 ether, "JEJU");
        } else {
            tokenAddress = existingToken;
            console.log("\n[1/2] Using existing token:", tokenAddress);
        }
        
        // 2. Deploy rewards contract
        console.log("\n[2/2] Deploying NodeOperatorRewards...");
        NodeOperatorRewards rewards = new NodeOperatorRewards(
            tokenAddress,
            deployer, // Performance oracle (will be set later)
            deployer
        );
        rewardsContract = address(rewards);
        console.log("   Rewards contract:", rewardsContract);
        
        vm.stopBroadcast();
        
        // Print summary
        console.log("\n============================================================");
        console.log("Deployment Complete!");
        console.log("============================================================");
        console.log("Network:", network);
        console.log("Reward Token:", tokenAddress);
        console.log("Rewards Contract:", rewardsContract);
        console.log("\nNext steps:");
        console.log("1. Transfer JEJU tokens to rewards contract for distribution");
        console.log("2. Set performance oracle: setPerformanceOracle(address)");
        console.log("3. Node operators can register with: registerNode()");
        console.log("4. Start rewards oracle: bun run rewards:oracle");
        
        console.log("\nSave these addresses:");
        console.log("export REWARD_TOKEN_ADDRESS=", tokenAddress);
        console.log("export REWARDS_CONTRACT=", rewardsContract);
    }
}

// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/prediction-markets/PredictionOracle.sol";

contract DeployPredictionOracle is Script {
    function run() external returns (address) {
        uint256 deployerPrivateKey = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerPrivateKey);

        console.log("==========================================");
        console.log("Deploying PredictionOracle");
        console.log("==========================================");
        console.log("Deployer:", deployer);
        console.log("Game Server (deployer):", deployer);

        vm.startBroadcast(deployerPrivateKey);

        PredictionOracle oracle = new PredictionOracle(deployer);

        vm.stopBroadcast();

        console.log("\n==========================================");
        console.log("PredictionOracle deployed at:", address(oracle));
        console.log("==========================================\n");

        return address(oracle);
    }
}

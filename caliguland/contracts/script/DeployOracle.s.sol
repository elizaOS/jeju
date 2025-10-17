// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PredictionOracle} from "../src/PredictionOracle.sol";

contract DeployOracle is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy PredictionOracle
        address gameServer = vm.envOr("GAME_SERVER_ADDRESS", msg.sender);
        
        PredictionOracle oracle = new PredictionOracle(gameServer);
        console.log("PredictionOracle deployed at:", address(oracle));
        console.log("Game server authorized:", gameServer);

        vm.stopBroadcast();
    }
}


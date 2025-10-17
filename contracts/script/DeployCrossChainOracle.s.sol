// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/oracle/PriceSource.sol";
import "../src/oracle/CrossChainPriceRelay.sol";

/**
 * @title Deploy Cross-Chain Oracle System
 * @notice Deploys PriceSource on Base and CrossChainPriceRelay on Jeju
 * 
 * Usage:
 *   # Step 1: Deploy PriceSource on Base
 *   forge script script/DeployCrossChainOracle.s.sol:DeployPriceSourceOnBase \
 *     --rpc-url $BASE_RPC \
 *     --broadcast \
 *     --verify
 * 
 *   # Step 2: Deploy CrossChainPriceRelay on Jeju
 *   export PRICE_SOURCE_ADDRESS=<from-step-1>
 *   forge script script/DeployCrossChainOracle.s.sol:DeployCrossChainRelayOnJeju \
 *     --rpc-url $JEJU_RPC \
 *     --broadcast \
 *     --verify
 * 
 *   # Step 3: Configure both
 *   forge script script/DeployCrossChainOracle.s.sol:ConfigureCrossChainOracle \
 *     --rpc-url $BASE_RPC
 */

contract DeployPriceSourceOnBase is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        address elizaOSToken = vm.envAddress("ELIZAOS_TOKEN_BASE");
        address crossChainRelayOnJeju = vm.envOr("CROSS_CHAIN_RELAY_JEJU", address(0));
        address priceUpdater = vm.envOr("PRICE_UPDATER", deployer);
        
        console.log("============================================================");
        console.log("Deploying PriceSource on Base L2");
        console.log("============================================================");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("elizaOS Token:", elizaOSToken);
        console.log("Cross-Chain Relay (Jeju):", crossChainRelayOnJeju);
        console.log("Price Updater:", priceUpdater);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        PriceSource priceSource = new PriceSource(
            elizaOSToken,
            crossChainRelayOnJeju,
            priceUpdater,
            deployer
        );
        
        vm.stopBroadcast();
        
        console.log("============================================================");
        console.log("PriceSource deployed at:", address(priceSource));
        console.log("============================================================");
        console.log("");
        console.log("Next Steps:");
        console.log("  1. Note the PriceSource address above");
        console.log("  2. Deploy CrossChainPriceRelay on Jeju:");
        console.log("     export PRICE_SOURCE_ADDRESS=", address(priceSource));
        console.log("     forge script script/DeployCrossChainOracle.s.sol:DeployCrossChainRelayOnJeju --rpc-url $JEJU_RPC --broadcast");
        console.log("");
        
        // Save deployment
        string memory json = "deployment";
        vm.serializeAddress(json, "priceSource", address(priceSource));
        vm.serializeAddress(json, "elizaOSToken", elizaOSToken);
        vm.serializeAddress(json, "priceUpdater", priceUpdater);
        string memory finalJson = vm.serializeUint(json, "chainId", block.chainid);
        
        vm.writeJson(finalJson, "deployments/base/price-source.json");
        console.log("Deployment saved to: deployments/base/price-source.json");
    }
}

contract DeployCrossChainRelayOnJeju is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        address priceSourceOnBase = vm.envAddress("PRICE_SOURCE_ADDRESS");
        address targetOracle = vm.envAddress("ORACLE_ADDRESS");
        
        console.log("============================================================");
        console.log("Deploying CrossChainPriceRelay on Jeju L3");
        console.log("============================================================");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("PriceSource (Base):", priceSourceOnBase);
        console.log("Target Oracle (Jeju):", targetOracle);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        CrossChainPriceRelay relay = new CrossChainPriceRelay(
            priceSourceOnBase,
            targetOracle,
            deployer
        );
        
        vm.stopBroadcast();
        
        console.log("============================================================");
        console.log("CrossChainPriceRelay deployed at:", address(relay));
        console.log("============================================================");
        console.log("");
        console.log("Next Steps:");
        console.log("  1. Update PriceSource with relay address:");
        console.log("     cast send", priceSourceOnBase);
        console.log("       setCrossChainRelay(address)", address(relay));
        console.log("       --rpc-url $BASE_RPC");
        console.log("");
        console.log("  2. Authorize relay to update oracle:");
        console.log("     cast send", targetOracle);
        console.log("       setPriceUpdater(address)", address(relay));
        console.log("       --rpc-url $JEJU_RPC");
        console.log("");
        console.log("  3. Test the relay:");
        console.log("     cast send", priceSourceOnBase);
        console.log("       updateAndRelay() --rpc-url $BASE_RPC");
        console.log("");
        
        // Save deployment
        string memory json = "deployment";
        vm.serializeAddress(json, "crossChainRelay", address(relay));
        vm.serializeAddress(json, "priceSource", priceSourceOnBase);
        vm.serializeAddress(json, "targetOracle", targetOracle);
        string memory finalJson = vm.serializeUint(json, "chainId", block.chainid);
        
        string memory network = _getNetworkName();
        vm.writeJson(finalJson, string.concat("deployments/", network, "/cross-chain-oracle.json"));
        console.log("Deployment saved to: deployments/", network, "/cross-chain-oracle.json");
    }
    
    function _getNetworkName() internal view returns (string memory) {
        if (block.chainid == 8888) return "mainnet";
        if (block.chainid == 420690) return "testnet";
        return "localnet";
    }
}

contract ConfigureCrossChainOracle is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        address priceSource = vm.envAddress("PRICE_SOURCE_ADDRESS");
        address crossChainRelay = vm.envAddress("CROSS_CHAIN_RELAY_ADDRESS");
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        
        console.log("============================================================");
        console.log("Configuring Cross-Chain Oracle System");
        console.log("============================================================");
        console.log("");
        
        // Configure PriceSource (on Base)
        console.log("Step 1: Configuring PriceSource on Base...");
        vm.startBroadcast(deployerPrivateKey);
        
        PriceSource(priceSource).setCrossChainRelay(crossChainRelay);
        console.log("  [OK] Set CrossChainRelay address");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("Step 2: Configure oracle authorization on Jeju");
        console.log("  Run this command on Jeju:");
        console.log("  cast send", oracle);
        console.log("    setPriceUpdater(address)", crossChainRelay);
        console.log("    --rpc-url $JEJU_RPC");
        console.log("");
        console.log("Step 3: Test the system:");
        console.log("  cast send", priceSource);
        console.log("    updateAndRelay() --rpc-url $BASE_RPC");
        console.log("");
        console.log("[OK] Configuration complete!");
    }
}


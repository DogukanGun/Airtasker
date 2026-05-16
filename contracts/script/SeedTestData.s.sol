// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TaskRegistry.sol";
import "../src/KitePassport.sol";
import "../test/helpers/MockUSDC.sol";

/// @notice Seeds the deployed marketplace with open tasks for a demo run.
/// Reads contract addresses from $DEPLOYMENT_FILE (default deployments/local.json)
/// and posts tasks from the wallet identified by $PRIVATE_KEY.
contract SeedTestData is Script {
    function run() external {
        string memory deploymentFile =
            vm.envOr("DEPLOYMENT_FILE", string("deployments/local.json"));
        uint256 posterKey = vm.envUint("PRIVATE_KEY");
        address poster    = vm.addr(posterKey);

        string memory json   = vm.readFile(deploymentFile);
        address usdcAddr     = vm.parseJsonAddress(json, ".usdc");
        address registryAddr = vm.parseJsonAddress(json, ".registry");

        MockUSDC     usdc     = MockUSDC(usdcAddr);
        TaskRegistry registry = TaskRegistry(registryAddr);

        vm.startBroadcast(posterKey);

        // Ensure poster has USDC and an allowance for the registry.
        if (usdc.balanceOf(poster) < 10_000 * 1e6) {
            usdc.mint(poster, 10_000 * 1e6);
        }
        usdc.approve(address(registry), type(uint256).max);

        registry.postTask(
            "ipfs://QmResearchTask1",
            50 * 1e6,
            1  * 1e6,
            TaskRegistry.TaskCategory.Research,
            block.timestamp + 7 days,
            0
        );

        registry.postTask(
            "ipfs://QmScrapingTask2",
            25 * 1e6,
            500_000,
            TaskRegistry.TaskCategory.WebScraping,
            block.timestamp + 3 days,
            0
        );

        registry.postTask(
            "ipfs://QmCodeTask3",
            100 * 1e6,
            2   * 1e6,
            TaskRegistry.TaskCategory.CodeGeneration,
            block.timestamp + 14 days,
            0
        );

        vm.stopBroadcast();

        console.log("Seeded 3 open tasks:");
        console.log("  1. Research          (50 USDC)");
        console.log("  2. WebScraping       (25 USDC)");
        console.log("  3. CodeGeneration   (100 USDC)");
    }
}

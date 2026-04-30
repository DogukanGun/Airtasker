// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/TaskRegistry.sol";
import "../src/KitePassport.sol";
import "../test/helpers/MockUSDC.sol";

/// @notice Seeds local anvil with test tasks, agents, and bids for demo.
/// Run after Deploy.s.sol:
///   forge script script/SeedTestData.s.sol --rpc-url http://localhost:8545 --broadcast
contract SeedTestData is Script {

    function run() external {
        // Read deployed addresses
        string memory json      = vm.readFile("deployments/local.json");
        address usdcAddr        = vm.parseJsonAddress(json, ".usdc");
        address passportAddr    = vm.parseJsonAddress(json, ".passport");
        address registryAddr    = vm.parseJsonAddress(json, ".registry");

        MockUSDC     usdc     = MockUSDC(usdcAddr);
        KitePassport passport = KitePassport(passportAddr);
        TaskRegistry registry = TaskRegistry(registryAddr);

        // Anvil default accounts
        uint256 poster1Key  = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        uint256 poster2Key  = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
        uint256 worker1Key  = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;

        address poster1  = vm.addr(poster1Key);
        address poster2  = vm.addr(poster2Key);
        address worker1  = vm.addr(worker1Key);

        // ── Register agents ─────────────────────────────────────────────
        vm.broadcast(poster1Key);
        passport.register("ipfs://QmPoster1Meta");

        vm.broadcast(worker1Key);
        passport.register("ipfs://QmWorker1Meta");

        // ── Poster1: mint USDC and post tasks ─────────────────────────────
        // Note: MockUSDC.mint is onlyOwner (deployer = anvil[0] = poster1)
        vm.startBroadcast(poster1Key);

        usdc.mint(poster1, 10_000 * 1e6);
        usdc.approve(address(registry), type(uint256).max);

        // Task 1: Research task
        registry.postTask(
            "ipfs://QmResearchTask1",
            50 * 1e6,   // 50 USDC bounty
            1  * 1e6,   // 1 USDC review fee
            TaskRegistry.TaskCategory.Research,
            block.timestamp + 7 days,
            0
        );

        // Task 2: Web scraping task
        registry.postTask(
            "ipfs://QmScrapingTask2",
            25 * 1e6,
            500_000,    // 0.5 USDC review fee
            TaskRegistry.TaskCategory.WebScraping,
            block.timestamp + 3 days,
            0
        );

        // Task 3: Code generation with minimum trust score
        registry.postTask(
            "ipfs://QmCodeTask3",
            100 * 1e6,
            2   * 1e6,
            TaskRegistry.TaskCategory.CodeGeneration,
            block.timestamp + 14 days,
            100  // requires at least 100 trust score
        );

        vm.stopBroadcast();

        // ── Poster2: post additional tasks ──────────────────────────────
        vm.startBroadcast(poster2Key);
        usdc.mint(poster2, 5_000 * 1e6);
        usdc.approve(address(registry), type(uint256).max);

        registry.postTask(
            "ipfs://QmDataTask4",
            15 * 1e6,
            300_000,
            TaskRegistry.TaskCategory.DataProcessing,
            block.timestamp + 5 days,
            0
        );
        vm.stopBroadcast();

        // ── Worker1: submit bids ─────────────────────────────────────────
        vm.startBroadcast(worker1Key);

        registry.submitBid(1, 45 * 1e6, "ipfs://QmWorker1Bid1", bytes("proof1"));
        registry.submitBid(2, 20 * 1e6, "ipfs://QmWorker1Bid2", bytes("proof2"));

        vm.stopBroadcast();

        // ── Poster1: accept bid on task 1 ────────────────────────────────
        vm.broadcast(poster1Key);
        registry.acceptBid(1, 1);

        console.log("Seed data complete.");
        console.log("Task 1 (Research, 50 USDC) - worker1 assigned");
        console.log("Task 2 (WebScraping, 25 USDC) - bids open");
        console.log("Task 3 (Code, 100 USDC) - bids open");
        console.log("Task 4 (DataProcessing, 15 USDC) - bids open");
    }
}

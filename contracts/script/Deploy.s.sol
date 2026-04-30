// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/KitePassport.sol";
import "../src/TaskEscrow.sol";
import "../src/TaskRegistry.sol";
import "../test/helpers/MockUSDC.sol";

/// @notice Two-phase deployment:
///   Phase 1: Deploy MockUSDC (if local) → KitePassport → TaskEscrow → TaskRegistry
///   Phase 2: Wire circular references (setRegistry on Escrow + Passport)
contract Deploy is Script {
    function run() external {
        uint256 deployerKey  = vm.envUint("PRIVATE_KEY");
        address deployer     = vm.addr(deployerKey);
        address usdcAddress  = vm.envOr("USDC_ADDRESS", address(0));
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);

        vm.startBroadcast(deployerKey);

        // ── Phase 1: Deploy ───────────────────────────────────────────
        // Use MockUSDC on local networks (chainId 31337) or if USDC_ADDRESS not set
        MockUSDC mockUsdc;
        if (usdcAddress == address(0)) {
            mockUsdc   = new MockUSDC();
            usdcAddress = address(mockUsdc);
            console.log("MockUSDC deployed at:", usdcAddress);

            // Mint test USDC to deployer for seeding
            mockUsdc.mint(deployer, 1_000_000 * 1e6); // 1M USDC
        }

        KitePassport passport = new KitePassport();
        console.log("KitePassport deployed at:", address(passport));

        TaskEscrow escrow = new TaskEscrow(usdcAddress, address(passport), feeRecipient);
        console.log("TaskEscrow deployed at:", address(escrow));

        TaskRegistry reg = new TaskRegistry(usdcAddress, address(escrow), address(passport));
        console.log("TaskRegistry deployed at:", address(reg));

        // ── Phase 2: Wire circular references ─────────────────────────
        escrow.setRegistry(address(reg));
        passport.setRegistry(address(reg));
        console.log("Circular references wired.");

        vm.stopBroadcast();

        // ── Output deployment JSON ─────────────────────────────────────
        string memory json = string(abi.encodePacked(
            '{"usdc":"',     vm.toString(usdcAddress),    '",',
            '"passport":"',  vm.toString(address(passport)), '",',
            '"escrow":"',    vm.toString(address(escrow)),   '",',
            '"registry":"',  vm.toString(address(reg)),      '"}'
        ));
        vm.writeFile("deployments/local.json", json);
        console.log("Deployment addresses written to deployments/local.json");
    }
}

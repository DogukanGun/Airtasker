// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/KitePassport.sol";

contract KitePassportTest is Test {
    KitePassport public passport;
    address public owner   = address(this);
    address public agent1  = makeAddr("agent1");
    address public agent2  = makeAddr("agent2");
    address public registry = makeAddr("registry");

    function setUp() public {
        passport = new KitePassport();
        passport.setRegistry(registry);
    }

    function test_register() public {
        vm.prank(agent1);
        passport.register("ipfs://Qm123");
        assertTrue(passport.isRegistered(agent1));
        assertEq(passport.getScore(agent1), passport.INITIAL_SCORE());
    }

    function test_cannotRegisterTwice() public {
        vm.startPrank(agent1);
        passport.register("ipfs://Qm123");
        vm.expectRevert("KitePassport: already registered");
        passport.register("ipfs://Qm456");
        vm.stopPrank();
    }

    function test_rewardCompletion() public {
        vm.prank(agent1);
        passport.register("ipfs://Qm123");

        uint256 before = passport.getScore(agent1);

        vm.prank(registry);
        passport.rewardCompletion(agent1, 1);

        assertEq(passport.getScore(agent1), before + passport.COMPLETION_REWARD());
    }

    function test_penalizeDispute() public {
        // Give agent1 a high enough score first so penalty doesn't floor to 0
        vm.startPrank(registry);
        for (uint256 i = 0; i < 5; i++) {
            passport.rewardCompletion(agent1, i); // +250
        }
        vm.stopPrank();

        uint256 before = passport.getScore(agent1); // 100 + 250 = 350

        vm.prank(registry);
        passport.penalizeDispute(agent1, 99);

        assertEq(passport.getScore(agent1), before - passport.DISPUTE_PENALTY());
    }

    function test_penalizeDoesNotGoNegative() public {
        vm.prank(agent1);
        passport.register("ipfs://Qm123");

        // Penalize many times
        vm.startPrank(registry);
        for (uint256 i = 0; i < 5; i++) {
            passport.penalizeDispute(agent1, i);
        }
        vm.stopPrank();

        assertEq(passport.getScore(agent1), 0);
    }

    function test_meetsMinimum() public {
        vm.prank(agent1);
        passport.register("ipfs://Qm123");

        assertTrue(passport.meetsMinimum(agent1, 50));
        assertTrue(passport.meetsMinimum(agent1, 100));
        assertFalse(passport.meetsMinimum(agent1, 101));
    }

    function test_autoRegisterOnReward() public {
        assertFalse(passport.isRegistered(agent2));
        vm.prank(registry);
        passport.rewardCompletion(agent2, 42);
        assertTrue(passport.isRegistered(agent2));
    }

    function test_onlyRegistryCanReward() public {
        vm.expectRevert("KitePassport: caller is not registry");
        passport.rewardCompletion(agent1, 1);
    }

    function test_scoreCapAtMax() public {
        vm.prank(agent1);
        passport.register("ipfs://Qm123");

        vm.startPrank(registry);
        for (uint256 i = 0; i < 300; i++) {
            passport.rewardCompletion(agent1, i);
        }
        vm.stopPrank();

        assertEq(passport.getScore(agent1), passport.MAX_SCORE());
    }
}

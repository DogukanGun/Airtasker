// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TaskRegistry.sol";
import "../src/TaskEscrow.sol";
import "../src/KitePassport.sol";
import "./helpers/MockUSDC.sol";

contract TaskRegistryTest is Test {
    MockUSDC     public usdc;
    KitePassport public passport;
    TaskEscrow   public escrow;
    TaskRegistry public registry;

    address public owner    = address(this);
    address public poster   = makeAddr("poster");
    address public worker   = makeAddr("worker");
    address public reviewer = makeAddr("reviewer");

    uint256 constant BOUNTY     = 50_000_000;
    uint256 constant REVIEW_FEE = 1_000_000;

    function setUp() public {
        usdc     = new MockUSDC();
        passport = new KitePassport();
        escrow   = new TaskEscrow(address(usdc), address(passport), address(this));
        registry = new TaskRegistry(address(usdc), address(escrow), address(passport));

        escrow.setRegistry(address(registry));
        passport.setRegistry(address(registry));

        // Fund poster
        usdc.mint(poster, 1_000_000_000);
        vm.prank(poster);
        usdc.approve(address(registry), type(uint256).max);
    }

    function _postTask() internal returns (uint256 taskId) {
        vm.prank(poster);
        taskId = registry.postTask(
            "ipfs://QmTaskMeta",
            BOUNTY,
            REVIEW_FEE,
            TaskRegistry.TaskCategory.Research,
            block.timestamp + 7 days,
            0
        );
    }

    function test_postTask() public {
        uint256 taskId = _postTask();
        assertEq(taskId, 1);

        TaskRegistry.Task memory t = registry.getFullTask(taskId);
        assertEq(t.poster, poster);
        assertEq(t.bountyUSDC, BOUNTY);
        assertEq(uint256(t.status), uint256(TaskRegistry.TaskStatus.Open));
    }

    function test_submitBid() public {
        uint256 taskId = _postTask();

        vm.prank(worker);
        uint256 bidId = registry.submitBid(taskId, BOUNTY, "ipfs://QmPitch", bytes(""));
        assertEq(bidId, 1);

        TaskRegistry.Bid[] memory bids = registry.getTaskBids(taskId);
        assertEq(bids.length, 1);
        assertEq(bids[0].worker, worker);
    }

    function test_acceptBid() public {
        uint256 taskId = _postTask();
        vm.prank(worker);
        uint256 bidId = registry.submitBid(taskId, BOUNTY, "", bytes(""));

        vm.prank(poster);
        registry.acceptBid(taskId, bidId);

        TaskRegistry.Task memory t = registry.getFullTask(taskId);
        assertEq(uint256(t.status), uint256(TaskRegistry.TaskStatus.Active));
        assertEq(t.assignedWorker, worker);
    }

    function test_submitResult() public {
        uint256 taskId = _postTask();
        vm.prank(worker);
        uint256 bidId = registry.submitBid(taskId, BOUNTY, "", bytes(""));
        vm.prank(poster);
        registry.acceptBid(taskId, bidId);

        vm.prank(worker);
        registry.submitResult(taskId, "ipfs://QmResult", keccak256("result content"));

        TaskRegistry.Task memory t = registry.getFullTask(taskId);
        assertEq(uint256(t.status), uint256(TaskRegistry.TaskStatus.UnderReview));
    }

    function test_triggerCompletion() public {
        uint256 taskId = _postTask();
        vm.prank(worker);
        uint256 bidId = registry.submitBid(taskId, BOUNTY, "", bytes(""));
        vm.prank(poster);
        registry.acceptBid(taskId, bidId);
        vm.prank(worker);
        registry.submitResult(taskId, "ipfs://QmResult", keccak256("result"));

        uint256 workerBefore = usdc.balanceOf(worker);

        registry.triggerCompletion(taskId, reviewer);

        TaskRegistry.Task memory t = registry.getFullTask(taskId);
        assertEq(uint256(t.status), uint256(TaskRegistry.TaskStatus.Completed));
        assertGt(usdc.balanceOf(worker), workerBefore);
        assertEq(passport.getScore(worker), passport.INITIAL_SCORE() + passport.COMPLETION_REWARD());
    }

    function test_cancelTask() public {
        uint256 taskId = _postTask();
        uint256 posterBefore = usdc.balanceOf(poster);

        vm.prank(poster);
        registry.cancelTask(taskId);

        TaskRegistry.Task memory t = registry.getFullTask(taskId);
        assertEq(uint256(t.status), uint256(TaskRegistry.TaskStatus.Cancelled));
        assertEq(usdc.balanceOf(poster), posterBefore + BOUNTY + REVIEW_FEE);
    }

    function test_getOpenTasks() public {
        _postTask();
        _postTask();

        (TaskRegistry.Task[] memory tasks, uint256 total) = registry.getOpenTasks(
            TaskRegistry.TaskCategory.Research, 0, 10
        );
        assertEq(tasks.length, 2);
        assertEq(total, 2);
    }

    function test_openTaskRemovedAfterBidAccepted() public {
        uint256 taskId = _postTask();
        vm.prank(worker);
        uint256 bidId = registry.submitBid(taskId, BOUNTY, "", bytes(""));
        vm.prank(poster);
        registry.acceptBid(taskId, bidId);

        assertEq(registry.getOpenTaskCount(), 0);
    }

    function test_bidRejectedIfTrustScoreTooLow() public {
        vm.prank(poster);
        uint256 taskId = registry.postTask(
            "ipfs://QmMeta",
            BOUNTY,
            REVIEW_FEE,
            TaskRegistry.TaskCategory.Research,
            block.timestamp + 7 days,
            500 // require trust score >= 500
        );

        vm.prank(worker); // worker has score 0 (not registered)
        vm.expectRevert("TaskRegistry: trust score too low");
        registry.submitBid(taskId, BOUNTY, "", bytes(""));
    }

    function test_deadlineInPastReverts() public {
        vm.prank(poster);
        vm.expectRevert("TaskRegistry: deadline in past");
        registry.postTask("ipfs://Qm", BOUNTY, REVIEW_FEE, TaskRegistry.TaskCategory.Other, block.timestamp - 1, 0);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/TaskEscrow.sol";
import "../src/KitePassport.sol";
import "./helpers/MockUSDC.sol";

contract TaskEscrowTest is Test {
    MockUSDC     public usdc;
    KitePassport public passport;
    TaskEscrow   public escrow;

    address public owner      = address(this);
    address public registry   = makeAddr("registry");
    address public feeRecip   = makeAddr("feeRecipient");
    address public poster     = makeAddr("poster");
    address public worker     = makeAddr("worker");
    address public reviewer   = makeAddr("reviewer");

    uint256 constant BOUNTY     = 50_000_000; // 50 USDC (6 dec)
    uint256 constant REVIEW_FEE = 1_000_000;  // 1 USDC

    function setUp() public {
        usdc     = new MockUSDC();
        passport = new KitePassport();
        escrow   = new TaskEscrow(address(usdc), address(passport), feeRecip);
        escrow.setRegistry(registry);

        // Mint USDC to poster
        usdc.mint(poster, 1_000_000_000);

        // Transfer total to escrow simulating the registry atomic deposit
        vm.prank(poster);
        usdc.transfer(address(escrow), BOUNTY + REVIEW_FEE);
    }

    function _deposit(uint256 taskId) internal {
        vm.prank(registry);
        escrow.deposit(taskId, poster, BOUNTY, REVIEW_FEE);
    }

    function test_deposit() public {
        _deposit(1);
        (uint256 total, uint256 bounty, uint256 review) = escrow.getEscrowBalance(1);
        assertEq(bounty, BOUNTY);
        assertEq(review, REVIEW_FEE);
        assertEq(total, BOUNTY + REVIEW_FEE);
    }

    function test_cannotDepositTwice() public {
        _deposit(1);
        vm.expectRevert("TaskEscrow: task already exists");
        vm.prank(registry);
        escrow.deposit(1, poster, BOUNTY, REVIEW_FEE);
    }

    function test_release() public {
        _deposit(1);
        vm.prank(registry);
        escrow.setWorker(1, worker);

        uint256 platformFee = (BOUNTY * 250) / 10_000;
        uint256 workerExpected = BOUNTY - platformFee;

        vm.prank(registry);
        escrow.release(1, reviewer);

        assertEq(usdc.balanceOf(worker),   workerExpected);
        assertEq(usdc.balanceOf(reviewer), REVIEW_FEE);
        assertEq(usdc.balanceOf(feeRecip), platformFee);
    }

    function test_refund() public {
        _deposit(1);

        uint256 before = usdc.balanceOf(poster);
        vm.prank(registry);
        escrow.refund(1);

        assertEq(usdc.balanceOf(poster), before + BOUNTY + REVIEW_FEE);
    }

    function test_cannotReleaseAfterRefund() public {
        _deposit(1);
        vm.prank(registry);
        escrow.setWorker(1, worker);
        vm.prank(registry);
        escrow.refund(1);

        vm.expectRevert("TaskEscrow: already settled");
        vm.prank(registry);
        escrow.release(1, reviewer);
    }

    function test_resolveDisputeWorkerWins() public {
        _deposit(1);
        vm.prank(registry);
        escrow.setWorker(1, worker);

        uint256 platformFee  = (BOUNTY * 250) / 10_000;
        uint256 posterBefore = usdc.balanceOf(poster);

        escrow.resolveDispute(1, true);

        assertEq(usdc.balanceOf(worker),  BOUNTY - platformFee);
        assertEq(usdc.balanceOf(feeRecip), platformFee);
        // review fee returned to poster when worker wins
        assertEq(usdc.balanceOf(poster), posterBefore + REVIEW_FEE);
    }

    function test_resolveDisputePosterWins() public {
        _deposit(1);
        vm.prank(registry);
        escrow.setWorker(1, worker);

        uint256 posterBefore = usdc.balanceOf(poster);
        escrow.resolveDispute(1, false);
        assertEq(usdc.balanceOf(poster), posterBefore + BOUNTY + REVIEW_FEE);
    }

    function test_onlyRegistryCanDeposit() public {
        vm.expectRevert("TaskEscrow: caller is not registry");
        escrow.deposit(1, poster, BOUNTY, REVIEW_FEE);
    }
}

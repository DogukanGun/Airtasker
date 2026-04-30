// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITaskEscrow {
    function deposit(
        uint256 taskId,
        address poster,
        uint256 bountyUSDC,
        uint256 reviewFeeUSDC
    ) external;

    function release(uint256 taskId, address reviewer) external;

    function refund(uint256 taskId) external;

    function resolveDispute(uint256 taskId, bool workerWins) external;

    function getEscrowBalance(uint256 taskId) external view returns (uint256 total, uint256 bounty, uint256 reviewFee);
}

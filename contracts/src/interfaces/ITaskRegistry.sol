// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interface used by TaskEscrow and external callers.
interface ITaskRegistry {
    function triggerCompletion(uint256 taskId, address reviewer) external;
    function triggerDispute(uint256 taskId) external;
}

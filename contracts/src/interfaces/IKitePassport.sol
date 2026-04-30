// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IKitePassport {
    function register(string calldata metadataURI) external;
    function rewardCompletion(address worker, uint256 taskId) external;
    function penalizeDispute(address party, uint256 taskId) external;
    function getScore(address agent) external view returns (uint256);
    function meetsMinimum(address agent, uint256 minScore) external view returns (bool);
    function isRegistered(address agent) external view returns (bool);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IKitePassport.sol";

/// @notice On-chain reputation and identity registry for agents and humans.
/// Trust score starts at INITIAL_SCORE, increases on task completion, decreases on disputes.
contract KitePassport is IKitePassport, Ownable {
    struct PassportRecord {
        uint256 score;
        uint256 tasksCompleted;
        uint256 tasksDisputed;
        uint256 lastUpdated;
        bool verified;
        string metadataURI;
    }

    uint256 public constant COMPLETION_REWARD = 50;
    uint256 public constant DISPUTE_PENALTY   = 150;
    uint256 public constant INITIAL_SCORE     = 100;
    uint256 public constant MAX_SCORE         = 10_000;

    address public registry;

    mapping(address => PassportRecord) private _passports;
    mapping(address => bool) private _registered;

    event PassportRegistered(address indexed agent, string metadataURI);
    event ScoreUpdated(address indexed agent, uint256 oldScore, uint256 newScore, string reason);
    event RegistrySet(address indexed registry);

    modifier onlyRegistry() {
        require(msg.sender == registry, "KitePassport: caller is not registry");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setRegistry(address _registry) external onlyOwner {
        registry = _registry;
        emit RegistrySet(_registry);
    }

    function register(string calldata metadataURI) external override {
        require(!_registered[msg.sender], "KitePassport: already registered");
        _registered[msg.sender] = true;
        _passports[msg.sender] = PassportRecord({
            score:          INITIAL_SCORE,
            tasksCompleted: 0,
            tasksDisputed:  0,
            lastUpdated:    block.timestamp,
            verified:       false,
            metadataURI:    metadataURI
        });
        emit PassportRegistered(msg.sender, metadataURI);
    }

    function rewardCompletion(address worker, uint256 /*taskId*/) external override onlyRegistry {
        _ensureRegistered(worker);
        PassportRecord storage p = _passports[worker];
        uint256 oldScore = p.score;
        uint256 newScore = _min(oldScore + COMPLETION_REWARD, MAX_SCORE);
        p.score = newScore;
        p.tasksCompleted += 1;
        p.lastUpdated = block.timestamp;
        emit ScoreUpdated(worker, oldScore, newScore, "completion");
    }

    function penalizeDispute(address party, uint256 /*taskId*/) external override onlyRegistry {
        _ensureRegistered(party);
        PassportRecord storage p = _passports[party];
        uint256 oldScore = p.score;
        uint256 newScore = oldScore > DISPUTE_PENALTY ? oldScore - DISPUTE_PENALTY : 0;
        p.score = newScore;
        p.tasksDisputed += 1;
        p.lastUpdated = block.timestamp;
        emit ScoreUpdated(party, oldScore, newScore, "dispute");
    }

    function getScore(address agent) external view override returns (uint256) {
        return _passports[agent].score;
    }

    function meetsMinimum(address agent, uint256 minScore) external view override returns (bool) {
        if (!_registered[agent]) return minScore == 0;
        return _passports[agent].score >= minScore;
    }

    function isRegistered(address agent) external view override returns (bool) {
        return _registered[agent];
    }

    function getPassport(address agent) external view returns (PassportRecord memory) {
        return _passports[agent];
    }

    function verifyAgent(address agent) external onlyOwner {
        require(_registered[agent], "KitePassport: not registered");
        _passports[agent].verified = true;
    }

    function _ensureRegistered(address agent) internal {
        if (!_registered[agent]) {
            _registered[agent] = true;
            _passports[agent] = PassportRecord({
                score:          INITIAL_SCORE,
                tasksCompleted: 0,
                tasksDisputed:  0,
                lastUpdated:    block.timestamp,
                verified:       false,
                metadataURI:    ""
            });
        }
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}

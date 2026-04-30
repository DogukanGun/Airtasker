// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IUSDC.sol";
import "./interfaces/IKitePassport.sol";
import "./interfaces/ITaskEscrow.sol";

/// @notice Holds USDC bounties in escrow and releases them upon verified task completion.
/// The registry contract is the only caller of deposit/release/refund.
contract TaskEscrow is ITaskEscrow, Ownable, ReentrancyGuard {
    struct EscrowRecord {
        address poster;
        address worker;
        uint256 bountyUSDC;
        uint256 reviewFeeUSDC;
        uint256 platformFeeUSDC;
        bool released;
        bool refunded;
    }

    IUSDC public immutable usdc;
    IKitePassport public immutable passport;
    address public registry;
    address public feeRecipient;
    uint256 public platformFeeBps = 250; // 2.5%

    mapping(uint256 => EscrowRecord) private _escrows;

    event Deposited(uint256 indexed taskId, address indexed poster, uint256 bounty, uint256 reviewFee);
    event Released(uint256 indexed taskId, address indexed worker, address indexed reviewer, uint256 workerPayout, uint256 reviewerPayout, uint256 platformFee);
    event Refunded(uint256 indexed taskId, address indexed poster, uint256 amount);
    event DisputeResolved(uint256 indexed taskId, bool workerWins);
    event RegistrySet(address indexed registry);
    event FeeRecipientSet(address indexed recipient);

    modifier onlyRegistry() {
        require(msg.sender == registry, "TaskEscrow: caller is not registry");
        _;
    }

    constructor(address _usdc, address _passport, address _feeRecipient) Ownable(msg.sender) {
        require(_usdc != address(0), "TaskEscrow: zero usdc");
        require(_passport != address(0), "TaskEscrow: zero passport");
        require(_feeRecipient != address(0), "TaskEscrow: zero fee recipient");
        usdc = IUSDC(_usdc);
        passport = IKitePassport(_passport);
        feeRecipient = _feeRecipient;
    }

    function setRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "TaskEscrow: zero registry");
        registry = _registry;
        emit RegistrySet(_registry);
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "TaskEscrow: zero recipient");
        feeRecipient = _recipient;
        emit FeeRecipientSet(_recipient);
    }

    function setPlatformFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "TaskEscrow: fee too high"); // max 10%
        platformFeeBps = _bps;
    }

    /// @notice Called atomically by TaskRegistry.postTaskWithAuthorization.
    function deposit(
        uint256 taskId,
        address poster,
        uint256 bountyUSDC,
        uint256 reviewFeeUSDC
    ) external override onlyRegistry {
        require(_escrows[taskId].poster == address(0), "TaskEscrow: task already exists");
        require(bountyUSDC > 0, "TaskEscrow: zero bounty");

        uint256 platformFee = (bountyUSDC * platformFeeBps) / 10_000;
        uint256 total = bountyUSDC + reviewFeeUSDC;

        _escrows[taskId] = EscrowRecord({
            poster:         poster,
            worker:         address(0),
            bountyUSDC:     bountyUSDC,
            reviewFeeUSDC:  reviewFeeUSDC,
            platformFeeUSDC: platformFee,
            released:       false,
            refunded:       false
        });

        // Funds are already transferred to this contract by the registry via transferWithAuthorization
        require(usdc.balanceOf(address(this)) >= total, "TaskEscrow: insufficient deposit");
        emit Deposited(taskId, poster, bountyUSDC, reviewFeeUSDC);
    }

    /// @notice Set the assigned worker — called by registry after bid acceptance.
    function setWorker(uint256 taskId, address worker) external onlyRegistry {
        require(_escrows[taskId].poster != address(0), "TaskEscrow: unknown task");
        _escrows[taskId].worker = worker;
    }

    /// @notice Release funds to worker and reviewer upon verified completion.
    function release(uint256 taskId, address reviewer) external override onlyRegistry nonReentrant {
        EscrowRecord storage e = _escrows[taskId];
        require(e.poster != address(0), "TaskEscrow: unknown task");
        require(!e.released && !e.refunded, "TaskEscrow: already settled");
        require(e.worker != address(0), "TaskEscrow: no worker assigned");

        e.released = true;

        uint256 workerPayout = e.bountyUSDC - e.platformFeeUSDC;

        if (e.platformFeeUSDC > 0) {
            usdc.transfer(feeRecipient, e.platformFeeUSDC);
        }
        if (e.reviewFeeUSDC > 0 && reviewer != address(0)) {
            usdc.transfer(reviewer, e.reviewFeeUSDC);
        }
        usdc.transfer(e.worker, workerPayout);

        emit Released(taskId, e.worker, reviewer, workerPayout, e.reviewFeeUSDC, e.platformFeeUSDC);
    }

    /// @notice Refund USDC to poster when task is cancelled before a worker is assigned.
    function refund(uint256 taskId) external override onlyRegistry nonReentrant {
        EscrowRecord storage e = _escrows[taskId];
        require(e.poster != address(0), "TaskEscrow: unknown task");
        require(!e.released && !e.refunded, "TaskEscrow: already settled");

        e.refunded = true;
        uint256 total = e.bountyUSDC + e.reviewFeeUSDC;
        usdc.transfer(e.poster, total);

        emit Refunded(taskId, e.poster, total);
    }

    /// @notice Admin dispute resolution.
    function resolveDispute(uint256 taskId, bool workerWins) external override onlyOwner nonReentrant {
        EscrowRecord storage e = _escrows[taskId];
        require(e.poster != address(0), "TaskEscrow: unknown task");
        require(!e.released && !e.refunded, "TaskEscrow: already settled");

        e.released = true;

        if (workerWins) {
            uint256 workerPayout = e.bountyUSDC - e.platformFeeUSDC;
            if (e.platformFeeUSDC > 0) usdc.transfer(feeRecipient, e.platformFeeUSDC);
            usdc.transfer(e.worker, workerPayout);
            if (e.reviewFeeUSDC > 0) usdc.transfer(e.poster, e.reviewFeeUSDC);
        } else {
            uint256 total = e.bountyUSDC + e.reviewFeeUSDC;
            usdc.transfer(e.poster, total);
        }

        emit DisputeResolved(taskId, workerWins);
    }

    function getEscrowBalance(uint256 taskId) external view override returns (uint256 total, uint256 bounty, uint256 reviewFee) {
        EscrowRecord storage e = _escrows[taskId];
        bounty = e.bountyUSDC;
        reviewFee = e.reviewFeeUSDC;
        total = bounty + reviewFee;
    }

    function getEscrowRecord(uint256 taskId) external view returns (EscrowRecord memory) {
        return _escrows[taskId];
    }
}

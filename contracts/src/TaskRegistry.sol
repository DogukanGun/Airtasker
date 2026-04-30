// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IUSDC.sol";
import "./interfaces/ITaskEscrow.sol";
import "./interfaces/IKitePassport.sol";
import "./interfaces/ITaskRegistry.sol";
import "./TaskEscrow.sol";

/// @notice On-chain task lifecycle registry. Source of truth for all tasks.
/// Agents discover work by querying getOpenTasks() or watching TaskPosted events.
contract TaskRegistry is ITaskRegistry, Ownable, ReentrancyGuard {

    enum TaskStatus   { Open, Active, UnderReview, Completed, Disputed, Cancelled }
    enum TaskCategory { DataProcessing, WebScraping, CodeGeneration, Research, Translation, Other }

    struct Task {
        uint256  taskId;
        address  poster;
        string   metadataURI;
        uint256  bountyUSDC;
        uint256  reviewFeeUSDC;
        TaskStatus   status;
        TaskCategory category;
        uint256  deadline;
        address  assignedWorker;
        string   resultURI;
        bytes32  resultHash;
        uint256  createdAt;
        uint256  completedAt;
        uint256  minTrustScore;
    }

    struct Bid {
        uint256 bidId;
        uint256 taskId;
        address worker;
        uint256 proposedFeeUSDC;
        string  pitchURI;
        bytes   sessionKeyProof;
        uint256 createdAt;
        bool    accepted;
    }

    IUSDC          public immutable usdc;
    TaskEscrow     public immutable escrow;
    IKitePassport  public immutable passport;

    uint256 public nextTaskId = 1;
    uint256 public nextBidId  = 1;

    mapping(uint256 => Task)   private _tasks;
    mapping(uint256 => Bid[])  private _bids;
    mapping(uint256 => uint256) private _taskBidCount;
    mapping(address => uint256[]) private _workerHistory;
    mapping(address => uint256[]) private _posterHistory;

    // taskId => all open task IDs (for discovery)
    uint256[] private _openTaskIds;
    mapping(uint256 => uint256) private _openTaskIndex; // taskId => index in _openTaskIds

    event TaskPosted(
        uint256 indexed taskId,
        address indexed poster,
        uint256 bountyUSDC,
        TaskCategory category,
        uint256 deadline,
        string metadataURI
    );
    event BidSubmitted(uint256 indexed taskId, uint256 indexed bidId, address indexed worker, uint256 proposedFeeUSDC);
    event BidAccepted(uint256 indexed taskId, uint256 indexed bidId, address indexed worker);
    event ResultSubmitted(uint256 indexed taskId, address indexed worker, string resultURI, bytes32 resultHash);
    event TaskCompleted(uint256 indexed taskId, address indexed worker, uint256 payoutUSDC);
    event TaskDisputed(uint256 indexed taskId, address indexed disputant);
    event TaskCancelled(uint256 indexed taskId, address indexed poster);

    constructor(address _usdc, address _escrow, address _passport) Ownable(msg.sender) {
        require(_usdc    != address(0), "TaskRegistry: zero usdc");
        require(_escrow  != address(0), "TaskRegistry: zero escrow");
        require(_passport!= address(0), "TaskRegistry: zero passport");
        usdc    = IUSDC(_usdc);
        escrow  = TaskEscrow(_escrow);
        passport= IKitePassport(_passport);
    }

    // ── Task Posting ────────────────────────────────────────────────────

    /// @notice Post a task with an EIP-3009 transferWithAuthorization so the
    /// USDC deposit and task creation happen atomically in one transaction.
    function postTaskWithAuthorization(
        string   calldata metadataURI,
        uint256  bountyUSDC,
        uint256  reviewFeeUSDC,
        TaskCategory category,
        uint256  deadline,
        uint256  minTrustScore,
        // EIP-3009 params
        uint256  value,
        uint256  validAfter,
        uint256  validBefore,
        bytes32  nonce,
        uint8    v,
        bytes32  r,
        bytes32  s
    ) external nonReentrant returns (uint256 taskId) {
        require(deadline > block.timestamp, "TaskRegistry: deadline in past");
        require(bountyUSDC > 0, "TaskRegistry: zero bounty");
        require(value == bountyUSDC + reviewFeeUSDC, "TaskRegistry: value mismatch");

        // Pull USDC directly into the escrow contract via EIP-3009
        usdc.transferWithAuthorization(
            msg.sender,
            address(escrow),
            value,
            validAfter,
            validBefore,
            nonce,
            v, r, s
        );

        taskId = _createTask(metadataURI, bountyUSDC, reviewFeeUSDC, category, deadline, minTrustScore);
        escrow.deposit(taskId, msg.sender, bountyUSDC, reviewFeeUSDC);
    }

    /// @notice Standard post task (requires prior ERC-20 approve to escrow).
    function postTask(
        string   calldata metadataURI,
        uint256  bountyUSDC,
        uint256  reviewFeeUSDC,
        TaskCategory category,
        uint256  deadline,
        uint256  minTrustScore
    ) external nonReentrant returns (uint256 taskId) {
        require(deadline > block.timestamp, "TaskRegistry: deadline in past");
        require(bountyUSDC > 0, "TaskRegistry: zero bounty");

        uint256 total = bountyUSDC + reviewFeeUSDC;
        usdc.transferFrom(msg.sender, address(escrow), total);

        taskId = _createTask(metadataURI, bountyUSDC, reviewFeeUSDC, category, deadline, minTrustScore);
        escrow.deposit(taskId, msg.sender, bountyUSDC, reviewFeeUSDC);
    }

    function _createTask(
        string   calldata metadataURI,
        uint256  bountyUSDC,
        uint256  reviewFeeUSDC,
        TaskCategory category,
        uint256  deadline,
        uint256  minTrustScore
    ) internal returns (uint256 taskId) {
        taskId = nextTaskId++;
        _tasks[taskId] = Task({
            taskId:         taskId,
            poster:         msg.sender,
            metadataURI:    metadataURI,
            bountyUSDC:     bountyUSDC,
            reviewFeeUSDC:  reviewFeeUSDC,
            status:         TaskStatus.Open,
            category:       category,
            deadline:       deadline,
            assignedWorker: address(0),
            resultURI:      "",
            resultHash:     bytes32(0),
            createdAt:      block.timestamp,
            completedAt:    0,
            minTrustScore:  minTrustScore
        });
        _posterHistory[msg.sender].push(taskId);
        _openTaskIds.push(taskId);
        _openTaskIndex[taskId] = _openTaskIds.length - 1;
        emit TaskPosted(taskId, msg.sender, bountyUSDC, category, deadline, metadataURI);
    }

    // ── Bidding ─────────────────────────────────────────────────────────

    function submitBid(
        uint256 taskId,
        uint256 proposedFeeUSDC,
        string  calldata pitchURI,
        bytes   calldata sessionKeyProof
    ) external returns (uint256 bidId) {
        Task storage t = _tasks[taskId];
        require(t.taskId != 0,                          "TaskRegistry: task not found");
        require(t.status == TaskStatus.Open,            "TaskRegistry: task not open");
        require(t.deadline > block.timestamp,           "TaskRegistry: task expired");
        require(proposedFeeUSDC <= t.bountyUSDC,        "TaskRegistry: fee exceeds bounty");
        require(
            passport.meetsMinimum(msg.sender, t.minTrustScore),
            "TaskRegistry: trust score too low"
        );

        bidId = nextBidId++;
        _bids[taskId].push(Bid({
            bidId:           bidId,
            taskId:          taskId,
            worker:          msg.sender,
            proposedFeeUSDC: proposedFeeUSDC,
            pitchURI:        pitchURI,
            sessionKeyProof: sessionKeyProof,
            createdAt:       block.timestamp,
            accepted:        false
        }));
        _taskBidCount[taskId]++;
        emit BidSubmitted(taskId, bidId, msg.sender, proposedFeeUSDC);
    }

    function acceptBid(uint256 taskId, uint256 bidId) external {
        Task storage t = _tasks[taskId];
        require(t.poster == msg.sender,        "TaskRegistry: not poster");
        require(t.status == TaskStatus.Open,   "TaskRegistry: task not open");

        Bid[] storage bids = _bids[taskId];
        bool found = false;
        for (uint256 i = 0; i < bids.length; i++) {
            if (bids[i].bidId == bidId) {
                bids[i].accepted = true;
                t.status = TaskStatus.Active;
                t.assignedWorker = bids[i].worker;
                escrow.setWorker(taskId, bids[i].worker);
                _workerHistory[bids[i].worker].push(taskId);
                _removeFromOpenTasks(taskId);
                emit BidAccepted(taskId, bidId, bids[i].worker);
                found = true;
                break;
            }
        }
        require(found, "TaskRegistry: bid not found");
    }

    // ── Result Submission & Completion ──────────────────────────────────

    function submitResult(
        uint256  taskId,
        string   calldata resultURI,
        bytes32  resultHash
    ) external {
        Task storage t = _tasks[taskId];
        require(t.assignedWorker == msg.sender, "TaskRegistry: not worker");
        require(t.status == TaskStatus.Active,  "TaskRegistry: task not active");

        t.resultURI  = resultURI;
        t.resultHash = resultHash;
        t.status     = TaskStatus.UnderReview;
        emit ResultSubmitted(taskId, msg.sender, resultURI, resultHash);
    }

    /// @notice Called by the API after a reviewer submits a PASS verdict.
    function triggerCompletion(uint256 taskId, address reviewer) external override onlyOwner {
        Task storage t = _tasks[taskId];
        require(t.status == TaskStatus.UnderReview, "TaskRegistry: not under review");

        t.status      = TaskStatus.Completed;
        t.completedAt = block.timestamp;

        passport.rewardCompletion(t.assignedWorker, taskId);
        escrow.release(taskId, reviewer);

        emit TaskCompleted(taskId, t.assignedWorker, t.bountyUSDC);
    }

    // ── Cancellation & Dispute ───────────────────────────────────────────

    function cancelTask(uint256 taskId) external {
        Task storage t = _tasks[taskId];
        require(t.poster == msg.sender,        "TaskRegistry: not poster");
        require(t.status == TaskStatus.Open,   "TaskRegistry: can only cancel open tasks");

        t.status = TaskStatus.Cancelled;
        _removeFromOpenTasks(taskId);
        escrow.refund(taskId);
        emit TaskCancelled(taskId, msg.sender);
    }

    function disputeTask(uint256 taskId) external {
        Task storage t = _tasks[taskId];
        require(
            msg.sender == t.poster || msg.sender == t.assignedWorker,
            "TaskRegistry: not a party"
        );
        require(
            t.status == TaskStatus.Active || t.status == TaskStatus.UnderReview,
            "TaskRegistry: cannot dispute"
        );
        t.status = TaskStatus.Disputed;
        passport.penalizeDispute(msg.sender, taskId);
        emit TaskDisputed(taskId, msg.sender);
    }

    function triggerDispute(uint256 taskId) external override onlyOwner {
        this.disputeTask(taskId);
    }

    // ── View Functions ───────────────────────────────────────────────────

    function getTask(uint256 taskId) external view returns (
        uint256 id,
        address poster,
        address assignedWorker,
        uint256 bountyUSDC,
        uint256 reviewFeeUSDC,
        TaskStatus status,
        uint256 deadline,
        uint256 minTrustScore
    ) {
        Task storage t = _tasks[taskId];
        require(t.taskId != 0, "TaskRegistry: task not found");
        return (t.taskId, t.poster, t.assignedWorker, t.bountyUSDC, t.reviewFeeUSDC, t.status, t.deadline, t.minTrustScore);
    }

    function getFullTask(uint256 taskId) external view returns (Task memory) {
        require(_tasks[taskId].taskId != 0, "TaskRegistry: task not found");
        return _tasks[taskId];
    }

    function getTaskBids(uint256 taskId) external view returns (Bid[] memory) {
        return _bids[taskId];
    }

    function getOpenTaskIds(uint256 offset, uint256 limit) external view returns (uint256[] memory ids, uint256 total) {
        total = _openTaskIds.length;
        if (offset >= total) return (new uint256[](0), total);
        uint256 end = offset + limit > total ? total : offset + limit;
        ids = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            ids[i - offset] = _openTaskIds[i];
        }
    }

    function getOpenTasks(
        TaskCategory category,
        uint256 offset,
        uint256 limit
    ) external view returns (Task[] memory tasks, uint256 total) {
        // Count matching tasks first
        uint256 count = 0;
        for (uint256 i = 0; i < _openTaskIds.length; i++) {
            if (_tasks[_openTaskIds[i]].category == category) count++;
        }
        total = count;

        if (offset >= count) return (new Task[](0), total);
        uint256 end = offset + limit > count ? count : offset + limit;
        tasks = new Task[](end - offset);

        uint256 matched = 0;
        uint256 collected = 0;
        for (uint256 i = 0; i < _openTaskIds.length && collected < end - offset; i++) {
            Task storage t = _tasks[_openTaskIds[i]];
            if (t.category == category) {
                if (matched >= offset) {
                    tasks[collected++] = t;
                }
                matched++;
            }
        }
    }

    function getWorkerHistory(address worker) external view returns (uint256[] memory) {
        return _workerHistory[worker];
    }

    function getPosterHistory(address poster) external view returns (uint256[] memory) {
        return _posterHistory[poster];
    }

    function getOpenTaskCount() external view returns (uint256) {
        return _openTaskIds.length;
    }

    // ── Internal ─────────────────────────────────────────────────────────

    function _removeFromOpenTasks(uint256 taskId) internal {
        uint256 index = _openTaskIndex[taskId];
        uint256 last  = _openTaskIds[_openTaskIds.length - 1];
        _openTaskIds[index] = last;
        _openTaskIndex[last] = index;
        _openTaskIds.pop();
        delete _openTaskIndex[taskId];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { AeonRegistry } from "./AeonRegistry.sol";
import { IAeonAgentNFT } from "./interfaces/IAeonAgentNFT.sol";

/// @title AeonEscrow
/// @notice Holds a client's payment for one job until the evaluator accepts the result, a timer
/// runs out, or both sides agree on a split. The payee is the token owner when the job is created.
/// @dev Every exit is a state change first, then payments. A payment that cannot be pushed is kept
/// for the recipient to withdraw, so no single address can block a settlement.
contract AeonEscrow is ReentrancyGuard {
    enum State {
        None,
        Funded,
        Submitted,
        Completed,
        Disputed,
        Declined,
        Refunded,
        TimedOut,
        Split,
        ForceClosed
    }

    struct Job {
        address client;
        address payee;
        address evaluator;
        uint256 tokenId;
        uint128 amount;
        uint64 expiredAt;
        uint32 acceptWindow;
        uint64 submittedAt;
        uint64 disputedAt;
        bytes32 taskHash;
        bytes32 resultHash;
        State state;
    }

    struct Config {
        address feeRecipient;
        uint16 feeBps;
        uint128 minAmount;
        uint32 minWindow;
        uint32 maxWindow;
        uint64 maxLifetime;
        uint64 disputeLimit;
    }

    uint256 public constant SIGN_JOBS = 1 << 1;
    uint16 public constant MAX_FEE_BPS = 1000;
    uint8 internal constant OUTCOME_COMPLETED = 0;
    uint8 internal constant OUTCOME_DISPUTED = 1;
    uint256 internal constant PUSH_GAS = 100_000;

    IAeonAgentNFT public immutable nft;
    AeonRegistry public immutable registry;
    address public immutable feeRecipient;
    uint16 public immutable feeBps;
    uint128 public immutable minAmount;
    uint32 public immutable minWindow;
    uint32 public immutable maxWindow;
    uint64 public immutable maxLifetime;
    uint64 public immutable disputeLimit;

    uint256 public nextJobId = 1;
    mapping(uint256 jobId => Job) private _jobs;
    mapping(uint256 jobId => bytes32) private _clientSplit;
    mapping(uint256 jobId => bytes32) private _providerSplit;
    mapping(address account => uint256) public pendingWithdrawals;

    event JobCreated(
        uint256 indexed jobId,
        uint256 indexed tokenId,
        address indexed client,
        address payee,
        address evaluator,
        uint128 amount,
        uint64 expiredAt,
        uint32 acceptWindow,
        bytes32 taskHash
    );
    event JobDeclined(uint256 indexed jobId);
    event JobRefunded(uint256 indexed jobId);
    event JobSubmitted(uint256 indexed jobId, bytes32 resultHash);
    event JobCompleted(uint256 indexed jobId, uint256 payout, uint256 fee);
    event JobDisputed(uint256 indexed jobId);
    event JobTimedOut(uint256 indexed jobId, uint256 payout, uint256 fee);
    event SplitProposed(
        uint256 indexed jobId, address indexed by, uint256 toClient, uint256 toProvider
    );
    event JobSplit(uint256 indexed jobId, uint256 toClient, uint256 payout, uint256 fee);
    event JobForceClosed(uint256 indexed jobId);
    event PaymentDeferred(address indexed to, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error ZeroAddress();
    error BadConfig();
    error ListingInactive();
    error AmountTooLow(uint256 sent, uint256 required);
    error BadExpiry();
    error BadWindow();
    error BadEvaluator();
    error ClientIsPayee();
    error WrongState(State current);
    error NotProvider();
    error NotEvaluator();
    error NotParty();
    error TooEarly();
    error TooLate();
    error BadSplit();
    error NothingToWithdraw();
    error WithdrawFailed();

    constructor(IAeonAgentNFT nft_, AeonRegistry registry_, Config memory c) {
        if (address(nft_) == address(0) || address(registry_) == address(0)) revert ZeroAddress();
        if (c.feeRecipient == address(0)) revert ZeroAddress();
        if (
            c.feeBps > MAX_FEE_BPS || c.minWindow == 0 || c.minWindow > c.maxWindow
                || c.maxLifetime < c.minWindow || c.disputeLimit == 0
        ) revert BadConfig();
        nft = nft_;
        registry = registry_;
        feeRecipient = c.feeRecipient;
        feeBps = c.feeBps;
        minAmount = c.minAmount;
        minWindow = c.minWindow;
        maxWindow = c.maxWindow;
        maxLifetime = c.maxLifetime;
        disputeLimit = c.disputeLimit;
    }

    // ------------------------------------------------------------ submit and settle

    /// @notice The provider commits to a result (the hash of the encrypted result envelope).
    function submit(uint256 jobId, bytes32 resultHash) external nonReentrant {
        Job storage job = _jobInState(jobId, State.Funded);
        if (!_isProvider(job, msg.sender)) revert NotProvider();
        if (block.timestamp >= job.expiredAt) revert TooLate();
        job.state = State.Submitted;
        job.submittedAt = uint64(block.timestamp);
        job.resultHash = resultHash;
        emit JobSubmitted(jobId, resultHash);
    }

    /// @notice The evaluator accepts the result. The payee gets the amount minus the fee.
    function complete(uint256 jobId) external nonReentrant {
        Job storage job = _jobInState(jobId, State.Submitted);
        if (msg.sender != job.evaluator) revert NotEvaluator();
        job.state = State.Completed;
        (uint256 payout, uint256 fee) = _split(job.amount);
        emit JobCompleted(jobId, payout, fee);
        _payProvider(job.payee, payout, fee);
        _record(job.tokenId, OUTCOME_COMPLETED, job.amount);
    }

    /// @notice The evaluator rejects the result inside the accept window.
    function dispute(uint256 jobId) external nonReentrant {
        Job storage job = _jobInState(jobId, State.Submitted);
        if (msg.sender != job.evaluator) revert NotEvaluator();
        if (block.timestamp >= uint256(job.submittedAt) + job.acceptWindow) revert TooLate();
        job.state = State.Disputed;
        job.disputedAt = uint64(block.timestamp);
        emit JobDisputed(jobId);
        _record(job.tokenId, OUTCOME_DISPUTED, 0);
    }

    /// @notice Anyone can pay the provider once the evaluator stayed silent for the whole window.
    function claimTimeout(uint256 jobId) external nonReentrant {
        Job storage job = _jobInState(jobId, State.Submitted);
        if (block.timestamp < uint256(job.submittedAt) + job.acceptWindow) revert TooEarly();
        job.state = State.TimedOut;
        (uint256 payout, uint256 fee) = _split(job.amount);
        emit JobTimedOut(jobId, payout, fee);
        _payProvider(job.payee, payout, fee);
        _record(job.tokenId, OUTCOME_COMPLETED, job.amount);
    }

    function createJob(
        uint256 tokenId,
        bytes32 taskHash,
        uint64 expiredAt,
        uint32 acceptWindow,
        address evaluator
    ) external payable nonReentrant returns (uint256 jobId) {
        address payee = _checkHire(tokenId, expiredAt, acceptWindow, evaluator);

        jobId = nextJobId++;
        Job storage job = _jobs[jobId];
        job.client = msg.sender;
        job.payee = payee;
        job.evaluator = evaluator;
        job.tokenId = tokenId;
        job.amount = SafeCast.toUint128(msg.value);
        job.expiredAt = expiredAt;
        job.acceptWindow = acceptWindow;
        job.taskHash = taskHash;
        job.state = State.Funded;
        _emitCreated(jobId, job);
    }

    function decline(uint256 jobId) external nonReentrant {
        Job storage job = _jobInState(jobId, State.Funded);
        if (!_isProvider(job, msg.sender)) revert NotProvider();
        job.state = State.Declined;
        emit JobDeclined(jobId);
        _pay(job.client, job.amount);
    }

    function claimRefund(uint256 jobId) external nonReentrant {
        Job storage job = _jobInState(jobId, State.Funded);
        if (block.timestamp < job.expiredAt) revert TooEarly();
        job.state = State.Refunded;
        emit JobRefunded(jobId);
        _pay(job.client, job.amount);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return _jobs[jobId];
    }

    function splitProposals(uint256 jobId)
        external
        view
        returns (bytes32 clientProposal, bytes32 providerProposal)
    {
        return (_clientSplit[jobId], _providerSplit[jobId]);
    }

    function quote(uint256 gross) external view returns (uint256 payout, uint256 fee) {
        return _split(gross);
    }

    function _jobInState(uint256 jobId, State expected) private view returns (Job storage job) {
        job = _jobs[jobId];
        if (job.state != expected) revert WrongState(job.state);
    }

    function _checkHire(uint256 tokenId, uint64 expiredAt, uint32 acceptWindow, address evaluator)
        private
        view
        returns (address payee)
    {
        if (!registry.isActive(tokenId)) revert ListingInactive();
        uint256 required = registry.getListing(tokenId).price;
        if (required < minAmount) required = minAmount;
        if (msg.value < required) revert AmountTooLow(msg.value, required);
        if (expiredAt < block.timestamp + minWindow || expiredAt > block.timestamp + maxLifetime) {
            revert BadExpiry();
        }
        if (acceptWindow < minWindow || acceptWindow > maxWindow) revert BadWindow();

        payee = nft.ownerOf(tokenId);
        if (msg.sender == payee) revert ClientIsPayee();
        if (
            evaluator == address(0) || evaluator == payee
                || evaluator == registry.agentWallet(tokenId)
        ) revert BadEvaluator();
    }

    function _emitCreated(uint256 jobId, Job storage job) private {
        emit JobCreated(
            jobId,
            job.tokenId,
            job.client,
            job.payee,
            job.evaluator,
            job.amount,
            job.expiredAt,
            job.acceptWindow,
            job.taskHash
        );
    }

    function _isProvider(Job storage job, address who) private view returns (bool) {
        return who == job.payee || nft.isAuthorized(job.tokenId, who, SIGN_JOBS);
    }

    function _split(uint256 gross) private view returns (uint256 payout, uint256 fee) {
        fee = gross * feeBps / 10_000;
        payout = gross - fee;
    }

    function _payProvider(address payee, uint256 payout, uint256 fee) private {
        _pay(payee, payout);
        _pay(feeRecipient, fee);
    }

    function _pay(address to, uint256 amount) private {
        if (amount == 0) return;
        bool ok;
        assembly ("memory-safe") {
            ok := call(PUSH_GAS, to, amount, 0, 0, 0, 0)
        }
        if (!ok) {
            pendingWithdrawals[to] += amount;
            emit PaymentDeferred(to, amount);
        }
    }

    function _record(uint256 tokenId, uint8 outcome, uint256 amount) private {
        try registry.recordSettlement(tokenId, outcome, amount) { } catch { }
    }
}

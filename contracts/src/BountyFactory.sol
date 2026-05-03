// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface ISolverRegistry {
    function recordSolve(address solver) external;
}

/// @title BountyFactory
/// @notice Escrow-and-settlement contract for verification bounties.
/// Lifecycle: create -> submit -> (challenge window) -> claim. Verification
/// itself happens off-chain (mock Lean4 in M2); this contract just trusts the
/// attestationHash submitted by the solver and enforces the time gates.
/// DisputeManager-driven slashing arrives in M3.
contract BountyFactory is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    enum Status { Open, Submitted, Challenged, Settled, Cancelled }

    struct Bounty {
        bytes32 specHash;
        address poster;
        uint256 amount;
        uint64 deadline;
        uint32 challengeWindow;
        Status status;
        address solver;
        bytes32 attestationHash;
        uint64 submittedAt;
    }

    IERC20 public immutable usdc;
    ISolverRegistry public immutable registry;

    mapping(uint256 => Bounty) public bounties;
    uint256 public nextBountyId = 1;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed poster,
        bytes32 specHash,
        uint256 amount,
        uint64 deadline,
        uint32 challengeWindow
    );
    event ProofSubmitted(
        uint256 indexed bountyId,
        address indexed solver,
        bytes32 attestationHash,
        uint64 submittedAt
    );
    event ProofChallenged(uint256 indexed bountyId, address indexed challenger);
    event BountyClaimed(uint256 indexed bountyId, address indexed solver, uint256 amount);
    event BountySettled(
        uint256 indexed bountyId,
        address indexed solver,
        uint256 amount,
        address indexed settler
    );
    event BountyCancelled(uint256 indexed bountyId);

    constructor(IERC20 _usdc, ISolverRegistry _registry) {
        require(address(_usdc) != address(0), "usdc=0");
        require(address(_registry) != address(0), "registry=0");
        usdc = _usdc;
        registry = _registry;
    }

    function createBounty(
        bytes32 specHash,
        uint256 amount,
        uint64 deadline,
        uint32 challengeWindow
    ) external nonReentrant returns (uint256 bountyId) {
        require(amount > 0, "amount=0");
        require(deadline > block.timestamp, "deadline past");
        require(challengeWindow > 0, "window=0");

        bountyId = nextBountyId++;
        bounties[bountyId] = Bounty({
            specHash: specHash,
            poster: msg.sender,
            amount: amount,
            deadline: deadline,
            challengeWindow: challengeWindow,
            status: Status.Open,
            solver: address(0),
            attestationHash: bytes32(0),
            submittedAt: 0
        });

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit BountyCreated(bountyId, msg.sender, specHash, amount, deadline, challengeWindow);
    }

    function submitProof(uint256 bountyId, bytes32 attestationHash) external {
        Bounty storage b = bounties[bountyId];
        require(b.status == Status.Open, "not open");
        require(block.timestamp <= b.deadline, "deadline passed");

        b.status = Status.Submitted;
        b.solver = msg.sender;
        b.attestationHash = attestationHash;
        b.submittedAt = uint64(block.timestamp);

        emit ProofSubmitted(bountyId, msg.sender, attestationHash, b.submittedAt);
    }

    /// @notice Operator-relay submission: anyone may post a proof on behalf of a
    /// solver who signed (bountyId, attestationHash, address(this)) via EIP-191
    /// personal_sign. The recovered address becomes the on-chain solver of
    /// record and is the only party that can later claim the bounty.
    function submitProofFor(
        uint256 bountyId,
        bytes32 attestationHash,
        address solver,
        bytes calldata signature
    ) external {
        Bounty storage b = bounties[bountyId];
        require(b.status == Status.Open, "not open");
        require(block.timestamp <= b.deadline, "deadline passed");
        require(solver != address(0), "solver=0");

        bytes32 messageHash = keccak256(
            abi.encode("Ascertainty submitProof", bountyId, attestationHash, address(this))
        );
        address recovered = messageHash.toEthSignedMessageHash().recover(signature);
        require(recovered == solver, "bad sig");

        b.status = Status.Submitted;
        b.solver = solver;
        b.attestationHash = attestationHash;
        b.submittedAt = uint64(block.timestamp);

        emit ProofSubmitted(bountyId, solver, attestationHash, b.submittedAt);
    }

    function challengeProof(uint256 bountyId) external {
        Bounty storage b = bounties[bountyId];
        require(b.status == Status.Submitted, "not submitted");
        require(block.timestamp < b.submittedAt + b.challengeWindow, "window over");
        b.status = Status.Challenged;
        emit ProofChallenged(bountyId, msg.sender);
        // M3: stake + DisputeManager re-run + slashing wired here
    }

    /// @notice Settle a submitted bounty after the challenge window has
    /// expired. Permissionless: anyone (the recorded solver, a public keeper,
    /// KeeperHub's hosted Turnkey wallet, a third-party watcher) can call
    /// this. USDC is always transferred to the recorded solver address, never
    /// to msg.sender — settlement infrastructure is therefore decoupled from
    /// solver custody. Idempotent via the Status.Submitted gate; duplicate
    /// calls revert with "not settleable".
    function settleBounty(uint256 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        require(b.status == Status.Submitted, "not settleable");
        require(block.timestamp >= b.submittedAt + b.challengeWindow, "window not over");

        b.status = Status.Settled;
        address solver = b.solver;
        uint256 amount = b.amount;
        usdc.safeTransfer(solver, amount);
        registry.recordSolve(solver);

        emit BountySettled(bountyId, solver, amount, msg.sender);
        // BountyClaimed kept for indexer back-compat with the pre-settleBounty
        // ABI; downstream consumers should migrate to BountySettled.
        emit BountyClaimed(bountyId, solver, amount);
    }

    /// @notice Solver-initiated settlement, kept for clients that already
    /// know to call this. Functionally equivalent to settleBounty when the
    /// caller IS the recorded solver — included so the solver-side claim
    /// flow doesn't have to know about the keeper architecture.
    function claimBounty(uint256 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        require(b.status == Status.Submitted, "not claimable");
        require(msg.sender == b.solver, "not solver");
        require(block.timestamp >= b.submittedAt + b.challengeWindow, "window not over");

        b.status = Status.Settled;
        uint256 amount = b.amount;
        usdc.safeTransfer(msg.sender, amount);
        registry.recordSolve(msg.sender);

        emit BountySettled(bountyId, msg.sender, amount, msg.sender);
        emit BountyClaimed(bountyId, msg.sender, amount);
    }

    function cancelBounty(uint256 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        require(b.status == Status.Open, "not cancellable");
        require(msg.sender == b.poster, "not poster");
        require(block.timestamp > b.deadline, "deadline not past");
        b.status = Status.Cancelled;
        usdc.safeTransfer(b.poster, b.amount);
        emit BountyCancelled(bountyId);
    }
}

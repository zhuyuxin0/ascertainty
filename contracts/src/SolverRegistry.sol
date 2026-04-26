// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title SolverRegistry
/// @notice Soulbound reputation ledger for Ascertainty solvers. BountyFactory
/// is granted recordSolve authority at deploy time so accepted-and-claimed
/// bounties bump the solver's reputation atomically with payout.
contract SolverRegistry is Ownable {
    mapping(address => uint256) public reputation;
    mapping(address => uint256) public solvedCount;
    mapping(address => bool) public authorized;

    event ReputationIncreased(address indexed solver, uint256 newReputation, uint256 newSolvedCount);
    event AuthorizedSet(address indexed who, bool allowed);

    constructor() Ownable(msg.sender) {}

    modifier onlyAuthorized() {
        require(authorized[msg.sender], "not authorized");
        _;
    }

    function setAuthorized(address who, bool allowed) external onlyOwner {
        authorized[who] = allowed;
        emit AuthorizedSet(who, allowed);
    }

    function recordSolve(address solver) external onlyAuthorized {
        reputation[solver] += 1;
        solvedCount[solver] += 1;
        emit ReputationIncreased(solver, reputation[solver], solvedCount[solver]);
    }
}

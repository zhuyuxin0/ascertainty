// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice 6-decimal ERC20 stand-in for USDC on 0G Galileo testnet, where no
/// canonical USDC exists. Permissionless mint so any wallet can fund a bounty
/// during the hackathon demo. Replace with a real bridged USDC for mainnet.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

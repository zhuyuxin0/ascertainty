// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

/// @title MinionNFT — solver minions in the Ascertainty atlas
/// @notice Each user can mint multiple minions, each tied to a role +
/// domain. The mint emits a deterministic seed (tokenId XOR owner XOR
/// blockhash low bytes) that the frontend uses to compose pixel-art
/// card art (body sprite, palette tint, accessory, background) from a
/// curated Kenney CC0 atlas. The on-chain footprint is intentionally
/// small: role (0 = spotter, 1 = solver, 2 = spectator), domain string,
/// and a uint64 seed. Card visuals are off-chain & deterministic.
contract MinionNFT is ERC721Enumerable {
    enum Role { Spotter, Solver, Spectator }

    struct MinionMeta {
        Role role;
        string domain;
        uint64 seed;       // deterministic seed for card art
        uint64 mintedAt;
        address minter;
    }

    mapping(uint256 => MinionMeta) public meta;
    uint256 public nextTokenId = 1;

    event MinionMinted(
        uint256 indexed tokenId,
        address indexed owner,
        uint8 role,
        string domain,
        uint64 seed
    );

    constructor() ERC721("Ascertainty Minion", "ASCMINION") {}

    /// @notice Mint a minion. Permissionless — anyone can mint, the
    /// per-mint cost is gas only. The seed used for card art is derived
    /// from (tokenId, msg.sender, blockhash) so it's unpredictable
    /// pre-mint but stable post-mint.
    function mint(uint8 role_, string calldata domain) external returns (uint256 tokenId) {
        require(role_ <= uint8(Role.Spectator), "bad role");
        require(bytes(domain).length > 0 && bytes(domain).length < 64, "bad domain");

        tokenId = nextTokenId++;
        uint64 seed = uint64(uint256(
            keccak256(abi.encode(tokenId, msg.sender, blockhash(block.number - 1)))
        ));

        _safeMint(msg.sender, tokenId);
        meta[tokenId] = MinionMeta({
            role: Role(role_),
            domain: domain,
            seed: seed,
            mintedAt: uint64(block.timestamp),
            minter: msg.sender
        });

        emit MinionMinted(tokenId, msg.sender, role_, domain, seed);
    }

    /// @notice Fetch all metadata for a single token in one call.
    function getMinion(uint256 tokenId)
        external
        view
        returns (
            address owner,
            uint8 role,
            string memory domain,
            uint64 seed,
            uint64 mintedAt,
            address minter
        )
    {
        owner = ownerOf(tokenId);
        MinionMeta memory m = meta[tokenId];
        role = uint8(m.role);
        domain = m.domain;
        seed = m.seed;
        mintedAt = m.mintedAt;
        minter = m.minter;
    }
}

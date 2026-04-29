/** Minimal ABIs for the contracts the dashboard interacts with directly.
 *  Backend has the canonical ABIs in og_chain.py; these are kept lean.
 */

export const BOUNTY_FACTORY_ABI = [
  {
    type: "function",
    name: "createBounty",
    stateMutability: "nonpayable",
    inputs: [
      { name: "specHash", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint64" },
      { name: "challengeWindow", type: "uint32" },
    ],
    outputs: [{ name: "bountyId", type: "uint256" }],
  },
  {
    type: "event",
    name: "BountyCreated",
    inputs: [
      { name: "bountyId", type: "uint256", indexed: true },
      { name: "poster", type: "address", indexed: true },
      { name: "specHash", type: "bytes32", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
      { name: "challengeWindow", type: "uint32", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const MINION_NFT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role_", type: "uint8" },
      { name: "domain", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getMinion",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "role", type: "uint8" },
      { name: "domain", type: "string" },
      { name: "seed", type: "uint64" },
      { name: "mintedAt", type: "uint64" },
      { name: "minter", type: "address" },
    ],
  },
  {
    type: "event",
    name: "MinionMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "role", type: "uint8", indexed: false },
      { name: "domain", type: "string", indexed: false },
      { name: "seed", type: "uint64", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const MINION_NFT_ADDRESS =
  "0x93DA9E9cF2f1647BD8f6dEB894CB34f8bF33e897" as const;

export const MOCK_USDC_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

"""Web3 client + contract instance loaders for 0G Galileo (chain 16602).

Single source of truth for the AsyncWeb3 connection, the operator account
loaded from `OG_PRIVATE_KEY`, and the four deployed contract instances
read from `backend/contract_addresses.json`. Both the publisher
(write-side) and the watcher (read-side) consume from here so we don't
maintain two separate web3 client lifecycles.

ABIs are minimal — only the functions and events we actually call. Full
artifact ABIs live in `contracts/artifacts/` and are gitignored.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import AsyncHTTPProvider, AsyncWeb3
from web3.contract import AsyncContract

_ADDR_PATH = Path(__file__).resolve().parent / "contract_addresses.json"


# ---------- minimal ABIs ----------

BOUNTY_FACTORY_ABI: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "createBounty",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "specHash", "type": "bytes32"},
            {"name": "amount", "type": "uint256"},
            {"name": "deadline", "type": "uint64"},
            {"name": "challengeWindow", "type": "uint32"},
        ],
        "outputs": [{"name": "bountyId", "type": "uint256"}],
    },
    {
        "type": "function",
        "name": "submitProof",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "bountyId", "type": "uint256"},
            {"name": "attestationHash", "type": "bytes32"},
        ],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "claimBounty",
        "stateMutability": "nonpayable",
        "inputs": [{"name": "bountyId", "type": "uint256"}],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "challengeProof",
        "stateMutability": "nonpayable",
        "inputs": [{"name": "bountyId", "type": "uint256"}],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "bounties",
        "stateMutability": "view",
        "inputs": [{"name": "", "type": "uint256"}],
        "outputs": [
            {"name": "specHash", "type": "bytes32"},
            {"name": "poster", "type": "address"},
            {"name": "amount", "type": "uint256"},
            {"name": "deadline", "type": "uint64"},
            {"name": "challengeWindow", "type": "uint32"},
            {"name": "status", "type": "uint8"},
            {"name": "solver", "type": "address"},
            {"name": "attestationHash", "type": "bytes32"},
            {"name": "submittedAt", "type": "uint64"},
        ],
    },
    {
        "type": "function",
        "name": "nextBountyId",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "type": "event",
        "name": "BountyCreated",
        "inputs": [
            {"name": "bountyId", "type": "uint256", "indexed": True},
            {"name": "poster", "type": "address", "indexed": True},
            {"name": "specHash", "type": "bytes32", "indexed": False},
            {"name": "amount", "type": "uint256", "indexed": False},
            {"name": "deadline", "type": "uint64", "indexed": False},
            {"name": "challengeWindow", "type": "uint32", "indexed": False},
        ],
        "anonymous": False,
    },
    {
        "type": "event",
        "name": "ProofSubmitted",
        "inputs": [
            {"name": "bountyId", "type": "uint256", "indexed": True},
            {"name": "solver", "type": "address", "indexed": True},
            {"name": "attestationHash", "type": "bytes32", "indexed": False},
            {"name": "submittedAt", "type": "uint64", "indexed": False},
        ],
        "anonymous": False,
    },
    {
        "type": "event",
        "name": "ProofChallenged",
        "inputs": [
            {"name": "bountyId", "type": "uint256", "indexed": True},
            {"name": "challenger", "type": "address", "indexed": True},
        ],
        "anonymous": False,
    },
    {
        "type": "event",
        "name": "BountyClaimed",
        "inputs": [
            {"name": "bountyId", "type": "uint256", "indexed": True},
            {"name": "solver", "type": "address", "indexed": True},
            {"name": "amount", "type": "uint256", "indexed": False},
        ],
        "anonymous": False,
    },
]

ERC20_ABI: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "balanceOf",
        "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "type": "function",
        "name": "allowance",
        "stateMutability": "view",
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "type": "function",
        "name": "approve",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "type": "function",
        "name": "mint",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [],
    },
    {
        "type": "function",
        "name": "decimals",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint8"}],
    },
]

SOLVER_REGISTRY_ABI: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "reputation",
        "stateMutability": "view",
        "inputs": [{"name": "", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "type": "function",
        "name": "solvedCount",
        "stateMutability": "view",
        "inputs": [{"name": "", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

AGENT_NFT_ABI: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "tokenOf",
        "stateMutability": "view",
        "inputs": [{"name": "", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "type": "function",
        "name": "metadata",
        "stateMutability": "view",
        "inputs": [{"name": "", "type": "uint256"}],
        "outputs": [
            {"name": "storageRootHash", "type": "bytes32"},
            {"name": "modelDescriptor", "type": "string"},
            {"name": "versionTag", "type": "string"},
            {"name": "mintedAt", "type": "uint256"},
            {"name": "lastUpdatedAt", "type": "uint256"},
        ],
    },
    {
        "type": "function",
        "name": "totalSupply",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "type": "function",
        "name": "ownerOf",
        "stateMutability": "view",
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "outputs": [{"name": "", "type": "address"}],
    },
    {
        "type": "function",
        "name": "mint",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "_storageRootHash", "type": "bytes32"},
            {"name": "_modelDescriptor", "type": "string"},
            {"name": "_versionTag", "type": "string"},
        ],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "type": "function",
        "name": "updateMetadata",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "tokenId", "type": "uint256"},
            {"name": "_newStorageRootHash", "type": "bytes32"},
            {"name": "_newVersionTag", "type": "string"},
        ],
        "outputs": [],
    },
]


# ---------- module state ----------

_w3: Optional[AsyncWeb3] = None
_account: Optional[LocalAccount] = None
_chain_id: Optional[int] = None
_addresses: Optional[dict[str, Any]] = None


def is_configured() -> bool:
    return bool(os.getenv("OG_PRIVATE_KEY")) and _ADDR_PATH.exists()


@lru_cache(maxsize=1)
def addresses() -> dict[str, Any]:
    """Return the deployed contract addresses block from contract_addresses.json."""
    return json.loads(_ADDR_PATH.read_text())


def get_account() -> LocalAccount:
    global _account
    if _account is None:
        key = os.getenv("OG_PRIVATE_KEY")
        if not key:
            raise RuntimeError("OG_PRIVATE_KEY not set")
        _account = Account.from_key(key.removeprefix("0x"))
    return _account


def get_w3() -> AsyncWeb3:
    global _w3
    if _w3 is None:
        rpc = os.getenv("OG_RPC_URL", "https://evmrpc-testnet.0g.ai")
        _w3 = AsyncWeb3(AsyncHTTPProvider(rpc))
    return _w3


async def get_chain_id() -> int:
    global _chain_id
    if _chain_id is None:
        _chain_id = await get_w3().eth.chain_id
    return _chain_id


def _contract(address_key: str, abi: list[dict[str, Any]]) -> AsyncContract:
    addr = addresses()["contracts"][address_key]
    return get_w3().eth.contract(address=AsyncWeb3.to_checksum_address(addr), abi=abi)


def get_factory() -> AsyncContract:
    return _contract("BountyFactory", BOUNTY_FACTORY_ABI)


def get_usdc() -> AsyncContract:
    return _contract("MockUSDC", ERC20_ABI)


def get_registry() -> AsyncContract:
    return _contract("SolverRegistry", SOLVER_REGISTRY_ABI)


def get_agent_nft() -> AsyncContract:
    return _contract("AgentNFT", AGENT_NFT_ABI)

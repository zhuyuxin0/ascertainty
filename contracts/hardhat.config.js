require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const OG_PRIVATE_KEY = process.env.OG_PRIVATE_KEY;
const OG_RPC_URL = process.env.OG_RPC_URL || "https://evmrpc-testnet.0g.ai";

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./src",
  },
  networks: {
    galileo: {
      url: OG_RPC_URL,
      chainId: 16602,
      accounts: OG_PRIVATE_KEY ? [OG_PRIVATE_KEY] : [],
    },
  },
};

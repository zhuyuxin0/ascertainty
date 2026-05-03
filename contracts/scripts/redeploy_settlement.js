// Redeploys SolverRegistry + BountyFactory together so the current operator
// wallet owns the registry and can authorize the new factory in a single
// flow. Reuses MockUSDC, AgentNFT, MinionNFT (which the personas + atlas
// already point at). Updates backend/contract_addresses.json.
//
// Triggered for the settleBounty() architecture change: the new factory
// emits BountySettled and exposes a permissionless settle path so that
// KeeperHub's hosted Turnkey wallet (or any keeper) can drive settlement
// on behalf of the recorded solver.
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const addrPath = path.resolve(__dirname, "../../backend/contract_addresses.json");
  const cur = JSON.parse(fs.readFileSync(addrPath, "utf8"));
  const usdcAddr = cur.contracts.MockUSDC;

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer       :", deployer.address);
  console.log("Balance        :", hre.ethers.formatEther(balance), "OG");
  console.log("Reusing USDC   :", usdcAddr);

  const SolverRegistry = await hre.ethers.getContractFactory("SolverRegistry");
  const registry = await SolverRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("New SolverRegistry ->", registryAddr);

  const BountyFactory = await hre.ethers.getContractFactory("BountyFactory");
  const factory = await BountyFactory.deploy(usdcAddr, registryAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("New BountyFactory  ->", factoryAddr);

  const authTx = await registry.setAuthorized(factoryAddr, true);
  await authTx.wait();
  console.log("Authorized factory on registry (tx:", authTx.hash + ")");

  cur.contracts.BountyFactory = factoryAddr;
  cur.contracts.SolverRegistry = registryAddr;
  cur.deployer = deployer.address;
  cur.deployedAt = Math.floor(Date.now() / 1000);
  cur.settlement = {
    permissionless: true,
    function: "settleBounty(uint256)",
    event: "BountySettled(uint256,address,uint256,address)",
  };
  fs.writeFileSync(addrPath, JSON.stringify(cur, null, 2) + "\n");
  console.log("Updated", addrPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

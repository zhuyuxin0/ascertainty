const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const addrPath = path.resolve(__dirname, "../../backend/contract_addresses.json");
  const cur = JSON.parse(fs.readFileSync(addrPath, "utf8"));
  const usdcAddr = cur.contracts.MockUSDC;
  const registryAddr = cur.contracts.SolverRegistry;

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer       :", deployer.address);
  console.log("Reusing USDC   :", usdcAddr);
  console.log("Reusing Reg    :", registryAddr);

  const BountyFactory = await hre.ethers.getContractFactory("BountyFactory");
  const factory = await BountyFactory.deploy(usdcAddr, registryAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("New BountyFactory ->", factoryAddr);

  const registry = await hre.ethers.getContractAt("SolverRegistry", registryAddr);
  const authTx = await registry.setAuthorized(factoryAddr, true);
  await authTx.wait();
  console.log("Authorized new factory on registry (tx:", authTx.hash + ")");

  const oldFactory = cur.contracts.BountyFactory;
  if (oldFactory && oldFactory !== factoryAddr) {
    const deauthTx = await registry.setAuthorized(oldFactory, false);
    await deauthTx.wait();
    console.log("De-authorized old factory", oldFactory, "(tx:", deauthTx.hash + ")");
  }

  cur.contracts.BountyFactory = factoryAddr;
  cur.deployedAt = Math.floor(Date.now() / 1000);
  fs.writeFileSync(addrPath, JSON.stringify(cur, null, 2) + "\n");
  console.log("Updated", addrPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const addrPath = path.resolve(__dirname, "../../backend/contract_addresses.json");
  const cur = JSON.parse(fs.readFileSync(addrPath, "utf8"));

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const MinionNFT = await hre.ethers.getContractFactory("MinionNFT");
  const minion = await MinionNFT.deploy();
  await minion.waitForDeployment();
  const minionAddr = await minion.getAddress();
  console.log("MinionNFT     ->", minionAddr);

  cur.contracts.MinionNFT = minionAddr;
  cur.deployedAt = Math.floor(Date.now() / 1000);
  fs.writeFileSync(addrPath, JSON.stringify(cur, null, 2) + "\n");
  console.log("Updated", addrPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

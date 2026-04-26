const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("Balance :", hre.ethers.formatEther(balance), "OG");

  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log("MockUSDC        ->", usdcAddr);

  const SolverRegistry = await hre.ethers.getContractFactory("SolverRegistry");
  const registry = await SolverRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("SolverRegistry  ->", registryAddr);

  const BountyFactory = await hre.ethers.getContractFactory("BountyFactory");
  const factory = await BountyFactory.deploy(usdcAddr, registryAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("BountyFactory   ->", factoryAddr);

  const AgentNFT = await hre.ethers.getContractFactory("AgentNFT");
  const nft = await AgentNFT.deploy();
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("AgentNFT        ->", nftAddr);

  const tx = await registry.setAuthorized(factoryAddr, true);
  await tx.wait();
  console.log("Authorized BountyFactory on SolverRegistry (tx:", tx.hash + ")");

  const out = {
    network: hre.network.name,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    deployedAt: Math.floor(Date.now() / 1000),
    contracts: {
      MockUSDC: usdcAddr,
      SolverRegistry: registryAddr,
      BountyFactory: factoryAddr,
      AgentNFT: nftAddr,
    },
  };

  const outPath = path.resolve(__dirname, "../../backend/contract_addresses.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log("Wrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

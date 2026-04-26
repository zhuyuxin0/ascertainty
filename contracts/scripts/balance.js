const hre = require("hardhat");
async function main() {
  const [s] = await hre.ethers.getSigners();
  const bal = await hre.ethers.provider.getBalance(s.address);
  console.log("addr:", s.address);
  console.log("balance:", hre.ethers.formatEther(bal), "OG");
}
main().catch((e) => { console.error(e); process.exit(1); });

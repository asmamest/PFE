const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting deployment on zkSync Sepolia testnet...");

  // 1. Déployer UserRegistry
  const UserRegistry = await hre.zkSyncDeploy("UserRegistry");
  const userRegistry = await UserRegistry.deploy();
  await userRegistry.deployed();
  console.log("✅ UserRegistry deployed to:", userRegistry.address);

  // 2. Déployer CommitmentRegistry
  const CommitmentRegistry = await hre.zkSyncDeploy("CommitmentRegistry");
  const commitmentRegistry = await CommitmentRegistry.deploy(userRegistry.address);
  await commitmentRegistry.deployed();
  console.log("✅ CommitmentRegistry deployed to:", commitmentRegistry.address);

  // 3. Déployer CredentialRegistry
  const CredentialRegistry = await hre.zkSyncDeploy("CredentialRegistry");
  const credentialRegistry = await CredentialRegistry.deploy(userRegistry.address);
  await credentialRegistry.deployed();
  console.log("✅ CredentialRegistry deployed to:", credentialRegistry.address);

  // 4. Déployer VerificationOracle
  // Tu dois avoir une adresse d'oracle (tu peux utiliser ton propre wallet pour le test)
  const [deployer] = await hre.ethers.getSigners();
  const oracleAddress = deployer.address; // Temporaire, à remplacer par l'adresse réelle de l'oracle plus tard
  
  const VerificationOracle = await hre.zkSyncDeploy("VerificationOracle");
  const verificationOracle = await VerificationOracle.deploy(oracleAddress);
  await verificationOracle.deployed();
  console.log("✅ VerificationOracle deployed to:", verificationOracle.address);

  console.log("\n📦 Deployment summary:");
  console.log("UserRegistry:", userRegistry.address);
  console.log("CommitmentRegistry:", commitmentRegistry.address);
  console.log("CredentialRegistry:", credentialRegistry.address);
  console.log("VerificationOracle:", verificationOracle.address);
  console.log("Oracle address (temporary):", oracleAddress);
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});

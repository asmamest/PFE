const { Wallet, Provider } = require("zksync-ethers");
const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Déploiement sur zkSync local...");

  const provider = new Provider("http://127.0.0.1:8545");
  const deployerPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const deployer = new Wallet(deployerPrivateKey, provider);
  console.log("Déployeur :", deployer.address);

  const deployerZk = new Deployer(hre, deployer);

  // 1. UserRegistry
  const UserRegistryArtifact = await hre.artifacts.readArtifact("UserRegistry");
  const userRegistry = await deployerZk.deploy(UserRegistryArtifact, []);
  console.log("UserRegistry:", await userRegistry.getAddress());

  // 2. CommitmentRegistry
  const CommitmentRegistryArtifact = await hre.artifacts.readArtifact("CommitmentRegistry");
  const commitmentRegistry = await deployerZk.deploy(CommitmentRegistryArtifact, [await userRegistry.getAddress()]);
  console.log("CommitmentRegistry:", await commitmentRegistry.getAddress());

  // 3. CredentialRegistry
  const CredentialRegistryArtifact = await hre.artifacts.readArtifact("CredentialRegistry");
  const credentialRegistry = await deployerZk.deploy(CredentialRegistryArtifact, [await userRegistry.getAddress()]);
  console.log("CredentialRegistry:", await credentialRegistry.getAddress());

  // 4. VerificationOracle
  const VerificationOracleArtifact = await hre.artifacts.readArtifact("VerificationOracle");
  const verificationOracle = await deployerZk.deploy(VerificationOracleArtifact, [deployer.address]);
  console.log("VerificationOracle:", await verificationOracle.getAddress());

  fs.writeFileSync("deployed-zk-local.json", JSON.stringify({
    userRegistry: await userRegistry.getAddress(),
    commitmentRegistry: await commitmentRegistry.getAddress(),
    credentialRegistry: await credentialRegistry.getAddress(),
    verificationOracle: await verificationOracle.getAddress(),
  }, null, 2));

  console.log("✅ Déploiement terminé ! Adresses sauvegardées dans deployed-zk-local.json");
}

main().catch(console.error);

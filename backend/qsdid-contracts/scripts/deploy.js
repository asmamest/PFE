const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Déployeur :", deployer.address);

  const UserRegistry = await hre.ethers.getContractFactory("UserRegistry");
  const userRegistry = await UserRegistry.deploy();
  await userRegistry.waitForDeployment();
  const userRegistryAddress = await userRegistry.getAddress();
  console.log("UserRegistry:", userRegistryAddress);

  const CommitmentRegistry = await hre.ethers.getContractFactory("CommitmentRegistry");
  const commitmentRegistry = await CommitmentRegistry.deploy(userRegistryAddress);
  await commitmentRegistry.waitForDeployment();
  const commitmentRegistryAddress = await commitmentRegistry.getAddress();
  console.log("CommitmentRegistry:", commitmentRegistryAddress);

  const CredentialRegistry = await hre.ethers.getContractFactory("CredentialRegistry");
  const credentialRegistry = await CredentialRegistry.deploy(userRegistryAddress);
  await credentialRegistry.waitForDeployment();
  const credentialRegistryAddress = await credentialRegistry.getAddress();
  console.log("CredentialRegistry:", credentialRegistryAddress);

  const VerificationOracle = await hre.ethers.getContractFactory("VerificationOracle");
  const verificationOracle = await VerificationOracle.deploy(deployer.address);
  await verificationOracle.waitForDeployment();
  const verificationOracleAddress = await verificationOracle.getAddress();
  console.log("VerificationOracle:", verificationOracleAddress);

  fs.writeFileSync("deployed.json", JSON.stringify({
    userRegistry: userRegistryAddress,
    commitmentRegistry: commitmentRegistryAddress,
    credentialRegistry: credentialRegistryAddress,
    verificationOracle: verificationOracleAddress,
  }, null, 2));
  console.log("Adresses sauvegardées dans deployed.json");
}

main().catch(console.error);

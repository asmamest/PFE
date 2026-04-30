const { Deployer } = require("@matterlabs/hardhat-zksync-deploy");
const { Wallet } = require("zksync-ethers");
const fs = require("fs");
require("dotenv").config();

module.exports = async function (hre) {
  console.log("🚀 Début du déploiement...");

  const privateKey = process.env.WALLET_PRIVATE_KEY;
  if (!privateKey) throw new Error("❌ WALLET_PRIVATE_KEY manquante");
  console.log("🔑 Clé privée trouvée");

  const zkWallet = new Wallet(privateKey);
  const deployer = new Deployer(hre, zkWallet);
  console.log("👤 Déployeur :", await zkWallet.getAddress());

  const userRegistryArtifact = await deployer.loadArtifact("UserRegistry");
  console.log("📦 Artifact UserRegistry chargé");

  const userRegistry = await deployer.deploy(userRegistryArtifact, []);
  const userRegistryAddress = await userRegistry.getAddress();
  console.log("✅ UserRegistry déployé à :", userRegistryAddress);

  fs.writeFileSync("deployed-zk-sepolia.json", JSON.stringify({ userRegistry: userRegistryAddress }, null, 2));
  console.log("💾 Adresse sauvegardée dans deployed-zk-sepolia.json");
};

const { ethers } = require("ethers");
const { Provider, Wallet, ContractFactory } = require("zksync-ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  console.log("🚀 Déploiement du CredentialRegistry seul sur zkSync Sepolia...");

  const privateKey = process.env.WALLET_PRIVATE_KEY;
  if (!privateKey) throw new Error("❌ WALLET_PRIVATE_KEY manquante");
  const rpc = "https://sepolia.era.zksync.dev";
  const provider = new Provider(rpc);
  const wallet = new Wallet(privateKey, provider);
  console.log("👤 Déployeur :", wallet.address);

  // Adresse du UserRegistry EXISTANT (celui qui contient ton issuer actif)
  const EXISTING_USER_REGISTRY = "0x85AED0Eeb5775EeF94275555481C059e96289eDf";

  // Récupérer l'artefact CredentialRegistry
  let artifactPath = path.join(__dirname, "../artifacts-zk/contracts/CredentialRegistry.sol/CredentialRegistry.json");
  if (!fs.existsSync(artifactPath)) {
    artifactPath = path.join(__dirname, "../artifacts/contracts/CredentialRegistry.sol/CredentialRegistry.json");
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  let bytecode = artifact.bytecode;
  if (!bytecode.startsWith("0x")) bytecode = "0x" + bytecode;

  const factory = new ContractFactory(artifact.abi, bytecode, wallet);
  console.log("📦 Déploiement du CredentialRegistry...");
  const contract = await factory.deploy(EXISTING_USER_REGISTRY);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`✅ CredentialRegistry déployé à : ${address}`);
  console.log(`🔗 Lié au UserRegistry : ${EXISTING_USER_REGISTRY}`);

  // Sauvegarde dans un fichier séparé
  const deployment = {
    credentialRegistry: address,
    linkedUserRegistry: EXISTING_USER_REGISTRY,
    network: "zkSyncSepolia",
    deployedAt: new Date().toISOString()
  };
  fs.writeFileSync("deployed-credential-only.json", JSON.stringify(deployment, null, 2));
  console.log("💾 Adresse sauvegardée dans deployed-credential-only.json");
}

main().catch(console.error);
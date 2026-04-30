const { ethers } = require("ethers");
const { Provider, Wallet, ContractFactory } = require("zksync-ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function main() {
  console.log("🚀 Déploiement sur zkSync Sepolia...");

  const privateKey = process.env.WALLET_PRIVATE_KEY;
  if (!privateKey) throw new Error("❌ WALLET_PRIVATE_KEY manquante");
  console.log("🔑 Clé chargée");

  const rpc = "https://sepolia.era.zksync.dev";
  const provider = new Provider(rpc);
  const wallet = new Wallet(privateKey, provider);
  console.log("👤 Déployeur :", wallet.address);

  const balance = await wallet.getBalance();
  console.log(`💰 Solde : ${ethers.formatEther(balance)} ETH`);
  if (balance === 0n) throw new Error("Solde nul, utilisez le faucet");

  // Fonction utilitaire pour déployer un contrat
  async function deployContract(contractName, args = []) {
    // Chercher l'artefact dans artifacts-zk (compilation zkSync) ou artifacts (fallback)
    let artifactPath = path.join(__dirname, `../artifacts-zk/contracts/${contractName}.sol/${contractName}.json`);
    if (!fs.existsSync(artifactPath)) {
      artifactPath = path.join(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`);
    }
    console.log(`📁 Chargement de l'artefact ${contractName} : ${artifactPath}`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    if (!artifact.bytecode || artifact.bytecode === "0x") {
      throw new Error(`Bytecode manquant pour ${contractName}. Recompilez avec 'npx hardhat compile --network zkSyncSepolia'`);
    }

    let bytecode = artifact.bytecode;
    if (!bytecode.startsWith("0x")) bytecode = "0x" + bytecode;
    const hexWithoutPrefix = bytecode.slice(2);
    if (hexWithoutPrefix.length % 64 !== 0) {
      const pad = "0".repeat(64 - (hexWithoutPrefix.length % 64));
      bytecode = "0x" + hexWithoutPrefix + pad;
      console.log(`⚠️ Bytecode pad ajouté pour ${contractName}`);
    }

    const factory = new ContractFactory(artifact.abi, bytecode, wallet);
    console.log(`📦 Déploiement de ${contractName}...`);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log(`✅ ${contractName} déployé à :`, address);
    return address;
  }

  // 1. Déployer UserRegistry
  const userRegistryAddress = await deployContract("UserRegistry");
  
  // 2. Déployer CredentialRegistry avec l'adresse de UserRegistry
  const credentialRegistryAddress = await deployContract("CredentialRegistry", [userRegistryAddress]);

  // Sauvegarder les adresses
  const deployment = {
    userRegistry: userRegistryAddress,
    credentialRegistry: credentialRegistryAddress,
    network: "zkSyncSepolia",
    deployedAt: new Date().toISOString()
  };
  fs.writeFileSync("deployed-zk-sepolia.json", JSON.stringify(deployment, null, 2));
  console.log("💾 Adresses sauvegardées dans deployed-zk-sepolia.json");
}

main().catch(console.error);
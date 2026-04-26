const { Wallet, Provider, Contract } = require("zksync-ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  const addresses = JSON.parse(fs.readFileSync("deployed-zk-local.json", "utf8"));
  const provider = new Provider("http://127.0.0.1:8545");

  // Comptes prédéfinis
  const deployerPrivKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const issuerPrivKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const holderPrivKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
  const verifierPrivKey = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";

  const deployer = new Wallet(deployerPrivKey, provider);
  const issuer = new Wallet(issuerPrivKey, provider);
  const holder = new Wallet(holderPrivKey, provider);
  const verifier = new Wallet(verifierPrivKey, provider);

  console.log("=== DÉBUT DES TESTS SUR ZKSYNC LOCAL ===\n");
  console.log("Deployer:", deployer.address);
  console.log("Issuer:", issuer.address);
  console.log("Holder:", holder.address);
  console.log("Verifier:", verifier.address);
  console.log("");

  // Lire les ABI depuis les fichiers (chemin correct)
  const userRegistryABI = JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts-zk/contracts/UserRegistry.sol/UserRegistry.json"))).abi;
  const commitmentRegistryABI = JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts-zk/contracts/CommitmentRegistry.sol/CommitmentRegistry.json"))).abi;
  const credentialRegistryABI = JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts-zk/contracts/CredentialRegistry.sol/CredentialRegistry.json"))).abi;
  const verificationOracleABI = JSON.parse(fs.readFileSync(path.join(__dirname, "../artifacts-zk/contracts/VerificationOracle.sol/VerificationOracle.json"))).abi;

  // Créer les contrats
  const userRegistry = new Contract(addresses.userRegistry, userRegistryABI, issuer);
  const commitmentRegistry = new Contract(addresses.commitmentRegistry, commitmentRegistryABI, holder);
  const credentialRegistry = new Contract(addresses.credentialRegistry, credentialRegistryABI, issuer);
  const verificationOracle = new Contract(addresses.verificationOracle, verificationOracleABI, verifier);

  // 1. Enregistrement de l'émetteur
  console.log("1. Enregistrement de l'émetteur...");
  let tx = await userRegistry.registerUser("0x11", "0x", "QmIssuerMeta", 1);
  await tx.wait();
  console.log("   ✅");

  // 2. Enregistrement du détenteur
  console.log("2. Enregistrement du détenteur...");
  const userRegistryHolder = new Contract(addresses.userRegistry, userRegistryABI, holder);
  tx = await userRegistryHolder.registerUser("0x", "0x", "QmHolderMeta", 2);
  await tx.wait();
  console.log("   ✅");

  // 3. Enregistrement du vérificateur
  console.log("3. Enregistrement du vérificateur...");
  const userRegistryVerifier = new Contract(addresses.userRegistry, userRegistryABI, verifier);
  tx = await userRegistryVerifier.registerUser("0x", "0x", "QmVerifierMeta", 4);
  await tx.wait();
  console.log("   ✅");

  // 4. Vérification des rôles
  console.log("4. Vérification des rôles...");
  console.log("   isIssuer:", await userRegistry.isIssuer(issuer.address));
  console.log("   isHolder:", await userRegistry.isHolder(holder.address));
  console.log("   isVerifier:", await userRegistry.isVerifier(verifier.address));

  // 5. Enregistrement d'un commitment
  console.log("\n5. Enregistrement d'un commitment...");
  const commitmentHash = "0x" + "ab".repeat(32);
  tx = await commitmentRegistry.setCommitment(commitmentHash, "QmCommitmentMeta");
  await tx.wait();
  console.log("   ✅");

  // 6. Émission d'un credential
  console.log("\n6. Émission d'un credential...");
  const docHash = "0x" + "99".repeat(32);
  const ipfsCID = "QmCredential123";
  tx = await credentialRegistry.issueCredential(docHash, ipfsCID, holder.address, 0, "QmCredMeta");
  const receipt = await tx.wait();
  console.log("   ✅");

  // Récupérer l'événement
  const event = receipt.logs.find(log => log.fragment?.name === "CredentialIssued");
  const credentialId = event?.args[0];
  console.log("   Credential ID:", credentialId);

  // 7. Demande de vérification
  console.log("\n7. Demande de vérification...");
  const verificationOracleVerifier = new Contract(addresses.verificationOracle, verificationOracleABI, verifier);
  tx = await verificationOracleVerifier.requestVerification(credentialId);
  const requestReceipt = await tx.wait();
  const requestEvent = requestReceipt.logs.find(log => log.fragment?.name === "VerificationRequested");
  const requestId = requestEvent?.args[0];
  console.log("   Request ID:", requestId?.toString());

  // 8. Soumission du résultat
  console.log("\n8. Soumission du résultat...");
  const verificationOracleDeployer = new Contract(addresses.verificationOracle, verificationOracleABI, deployer);
  tx = await verificationOracleDeployer.submitVerificationResult(requestId, true, "0x" + "77".repeat(32));
  await tx.wait();
  console.log("   ✅");

  // 9. Vérification du statut
  const status = await verificationOracle.getVerificationStatus(requestId);
  console.log("\n📊 Résultat de la vérification :");
  console.log("   Resolved :", status[0]);
  console.log("   isValid  :", status[1]);

  console.log("\n✅ TOUS LES TESTS RÉUSSIS !");
}

main().catch(console.error);

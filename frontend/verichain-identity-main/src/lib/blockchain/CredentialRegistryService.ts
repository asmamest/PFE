// src/lib/blockchain/CredentialRegistryService.ts
import { ethers } from "ethers";
import { CREDENTIAL_REGISTRY_ADDRESS } from "./constants";
import credentialRegistryAbi from "./CredentialRegistryAbi.json";

export interface CredentialOnChain {
  docHash: string;
  ipfsCID: string;
  issuer: string;
  holder: string;
  status: number; // 0: Active, 1: Revoked, 2: Expired
  issuedAt: number;
  expiresAt: number;
  metadataCID: string;
}

/**
 * Émet un nouveau credential.
 * @param docHash Hash du document (bytes32)
 * @param ipfsCID CID IPFS du credential chiffré + signature
 * @param holderAddress Adresse du détenteur
 * @param expiresAt Timestamp d'expiration (0 = jamais)
 * @param metadataCID CID IPFS des métadonnées additionnelles
 * @returns L'ID du credential émis (bytes32 sous forme de chaîne hex)
 */
export async function issueCredential(
  docHash: string,
  ipfsCID: string,
  holderAddress: string,
  expiresAt: number,
  metadataCID: string
): Promise<string> {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CREDENTIAL_REGISTRY_ADDRESS, credentialRegistryAbi, signer);

  const tx = await contract.issueCredential(
    docHash,
    ipfsCID,
    holderAddress,
    expiresAt,
    metadataCID
  );
  const receipt = await tx.wait();

  // Chercher l'event CredentialIssued
  const eventTopic = ethers.id("CredentialIssued(bytes32,address,address,bytes32,string,uint256,uint256)");
  const eventLog = receipt.logs?.find((log: any) => log.topics?.[0] === eventTopic);
  if (eventLog) {
    // topics[1] est directement le credentialId (bytes32) au format hexadécimal 0x...
    const credentialId = eventLog.topics[1];
    return credentialId;
  }
  throw new Error("Credential ID not found in transaction logs");
}

/**
 * Révoque un credential existant.
 * @param credentialId ID du credential (bytes32)
 */
export async function revokeCredential(credentialId: string): Promise<void> {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CREDENTIAL_REGISTRY_ADDRESS, credentialRegistryAbi, signer);
  const tx = await contract.revokeCredential(credentialId);
  await tx.wait();
}

/**
 * Récupère les informations d'un credential.
 * @param credentialId ID du credential (bytes32)
 */
export async function getCredential(credentialId: string): Promise<CredentialOnChain> {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(CREDENTIAL_REGISTRY_ADDRESS, credentialRegistryAbi, provider);
  const cred = await contract.getCredential(credentialId);
  return {
    docHash: cred.docHash,
    ipfsCID: cred.ipfsCID,
    issuer: cred.issuer,
    holder: cred.holder,
    status: Number(cred.status),
    issuedAt: Number(cred.issuedAt),
    expiresAt: Number(cred.expiresAt),
    metadataCID: cred.metadataCID,
  };
}

/**
 * Récupère tous les IDs des credentials d'un holder.
 * @param holderAddress Adresse du holder
 */
export async function getHolderCredentials(holderAddress: string): Promise<string[]> {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(CREDENTIAL_REGISTRY_ADDRESS, credentialRegistryAbi, provider);
  return await contract.getHolderCredentials(holderAddress);
}

/**
 * Récupère tous les IDs des credentials émis par un issuer.
 * @param issuerAddress Adresse de l'issuer
 */
export async function getIssuerCredentials(issuerAddress: string): Promise<string[]> {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(CREDENTIAL_REGISTRY_ADDRESS, credentialRegistryAbi, provider);
  return await contract.getIssuerCredentials(issuerAddress);
}

/**
 * Vérifie si un credential est actif et non expiré.
 * @param credentialId ID du credential (bytes32)
 */
export async function isCredentialValid(credentialId: string): Promise<boolean> {
  if (!window.ethereum) throw new Error("MetaMask not installed");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(CREDENTIAL_REGISTRY_ADDRESS, credentialRegistryAbi, provider);
  return await contract.isCredentialValid(credentialId);
}
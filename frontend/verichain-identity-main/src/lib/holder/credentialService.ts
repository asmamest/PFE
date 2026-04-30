// src/lib/holder/credentialService.ts
import { ethers } from "ethers";
import { CREDENTIAL_REGISTRY_ADDRESS } from "@/lib/blockchain/constants";
import credentialRegistryAbi from "@/lib/blockchain/CredentialRegistryAbi.json";
import { fetchFromIPFS } from "@/lib/ipfs/ipfsClient"; // ← utilisation du fallback multi‑gateway

export interface Credential {
  id: string;
  name: string;
  issuer: string;  
  issuerAddress: string;
  issuerName?: string;
  holderAddress: string;
  issuedAt: number;    // timestamp
  expiresAt: number;   // timestamp
  status: "active" | "expired" | "revoked" | "pending";
  ipfsCID: string;
  cid: string;
  metadataCID?: string;
  attributes: Record<string, any>;
  // Champs d'affichage
  issuedDate: string;   // formaté
  expiryDate?: string;  // formaté
  aiVerified: boolean;
}

// Récupère tous les credentials d'un holder
export async function fetchHolderCredentials(holderAddress: string): Promise<Credential[]> {
  if (!window.ethereum) throw new Error("MetaMask not available");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const contract = new ethers.Contract(CREDENTIAL_REGISTRY_ADDRESS, credentialRegistryAbi, provider);

  const credentialIds: string[] = await contract.getHolderCredentials(holderAddress);
  const credentials: Credential[] = [];

  for (const credentialId of credentialIds) {
    try {
      const credOnChain = await contract.getCredential(credentialId);
      const ipfsCID = credOnChain.ipfsCID;
      const issuerAddress = credOnChain.issuer;
      const statusCode = Number(credOnChain.status);
      const issuedAt = Number(credOnChain.issuedAt);
      const expiresAt = Number(credOnChain.expiresAt);
      const metadataCID = credOnChain.metadataCID;

      // Statut (actif, expiré, révoqué)
      let status: Credential["status"];
      if (statusCode === 0) {
        status = (expiresAt > 0 && expiresAt <= Math.floor(Date.now() / 1000)) ? "expired" : "active";
      } else if (statusCode === 1) {
        status = "revoked";
      } else {
        status = "expired";
      }

      // 🔁 Lecture IPFS résiliente via fetchFromIPFS (multi‑gateway)
      const credentialData = await fetchFromIPFS(ipfsCID);

      // Extraction des métadonnées
      const name = credentialData.name || credentialData.credentialSubject?.name || "Unnamed Credential";
      const issuerName = credentialData.issuer?.name || issuerAddress;
      const attributes = credentialData.credentialSubject || credentialData.claims || {};
      const aiVerified = credentialData.aiVerified === true;

      // Formatage des dates
      const issuedDate = new Date(issuedAt * 1000).toISOString().split('T')[0];
      const expiryDate = expiresAt > 0 ? new Date(expiresAt * 1000).toISOString().split('T')[0] : undefined;

      credentials.push({
        id: credentialId,
        name,
        issuer: issuerName || issuerAddress,
        cid: ipfsCID,
        issuerAddress,
        issuerName,
        holderAddress,
        issuedAt,
        expiresAt,
        status,
        ipfsCID,
        metadataCID,
        attributes,
        issuedDate,
        expiryDate,
        aiVerified,
      });
    } catch (err) {
      console.error(`Failed to load credential ${credentialId}:`, err);
    }
  }
  return credentials;
}
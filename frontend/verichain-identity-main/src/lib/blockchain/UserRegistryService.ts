import { ethers } from "ethers";
import abi from "./UserRegistryAbi.json";
import { USER_REGISTRY_ADDRESS } from "./constants";

export async function registerUserOnChain(
  mldsaPublicKeyHex: string,
  metadataCID: string,
  role: "issuer" | "holder" 
) {
  if (!(window as any).ethereum) throw new Error("MetaMask not installed");

  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, abi, signer);

  const mldsaBytes = ethers.hexlify(ethers.toUtf8Bytes(mldsaPublicKeyHex));

  let roleMask = 0;
  if (role === "issuer") roleMask = 1;
  else if (role === "holder") roleMask = 2;
  else roleMask = 4;

  const tx = await contract.registerUser(mldsaBytes, "0x", metadataCID, roleMask);
  await tx.wait();
  return tx;
}   

// Lit le metadataCID d'une adresse
export async function getUserMetadataCID(address: string): Promise<string> {
  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, abi, provider);
  const user = await contract.users(address);
  return user.metadataCID;
}

// Met à jour UNIQUEMENT le metadataCID de l'utilisateur connecté
// (garde les clés et les rôles inchangés)
export async function updateUserMetadataCID(newMetadataCID: string): Promise<void> {
  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, abi, signer);
  
  // Récupérer les données actuelles de l'utilisateur
  const user = await contract.users(await signer.getAddress());
  const currentMldsaKey = user.mldsaPublicKey;
  const currentMlkemKey = user.mlkemPublicKey;
  const currentRoles = user.roles;
  
  // Appeler updateUser avec les mêmes clés et rôles, mais le nouveau CID
  const tx = await contract.updateUser(
    currentMldsaKey,
    currentMlkemKey,
    newMetadataCID,
    currentRoles
  );
  await tx.wait();
}
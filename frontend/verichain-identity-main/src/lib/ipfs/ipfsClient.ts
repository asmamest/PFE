import { create } from 'ipfs-http-client';

const ipfs = create({ url: 'http://127.0.0.1:5001' });

const IPFS_GATEWAYS = [
  "http://127.0.0.1:8080/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/"
];

export async function fetchFromIPFS(cid: string): Promise<any> {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${gateway}${cid}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn(`Gateway failed: ${gateway}`, err);
    }
  }
  throw new Error(`All IPFS gateways failed for CID: ${cid}`);
}

export async function storeDIDDocument(did: string, publicKeyMultibase: string): Promise<string> {
  const doc = {
    '@context': 'https://www.w3.org/ns/did/v1',
    id: did,
    verificationMethod: [{
      id: `${did}#ml-dsa-65`,
      type: 'MlDsa65VerificationKey2026',
      controller: did,
      publicKeyMultibase,
    }],
    authentication: [`${did}#ml-dsa-65`],
  };
  const { cid } = await ipfs.add(JSON.stringify(doc));
  return cid.toString();
}

export async function storeInitialHolderProfile(did: string, publicKeyMultibase: string): Promise<string> {
  const profile = {
    did: did,
    publicKeyMultibase: publicKeyMultibase,
    fullName: "",
    role: "holder",
    createdAt: new Date().toISOString()
  };
  const { cid } = await ipfs.add(JSON.stringify(profile));
  return cid.toString();
}

export async function addFullNameToHolderProfile(existingCID: string, fullName: string): Promise<string> {
  const profile = await fetchFromIPFS(existingCID);
  profile.fullName = fullName.trim();
  profile.updatedAt = new Date().toISOString();
  const { cid: newCID } = await ipfs.add(JSON.stringify(profile));
  return newCID.toString();
}


export async function storeInitialIssuerProfile(did: string, publicKeyMultibase: string): Promise<string> {
  const profile = {
    '@context': 'https://www.w3.org/ns/did/v1',
    id: did,
    verificationMethod: [{
      id: `${did}#ml-dsa-65`,
      type: 'MlDsa65VerificationKey2026',
      controller: did,
      publicKeyMultibase,
    }],
    authentication: [`${did}#ml-dsa-65`],
    legalName: "",
    credentialTypes: [],
    verificationTag: "",
    role: "issuer",
    createdAt: new Date().toISOString()
  };
  const { cid } = await ipfs.add(JSON.stringify(profile));
  return cid.toString();
}

export async function updateIssuerProfile(existingCID: string, legalName: string, credentialTypes: string[], verificationTag: string): Promise<string> {
  const profile = await fetchFromIPFS(existingCID);
  profile.legalName = legalName;
  profile.credentialTypes = credentialTypes;
  profile.verificationTag = verificationTag;
  profile.updatedAt = new Date().toISOString();
  const { cid: newCID } = await ipfs.add(JSON.stringify(profile));
  return newCID.toString();
}

export { ipfs };

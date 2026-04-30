// src/lib/ipfs/fetchFromIPFS.ts

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://gateway.pinata.cloud/ipfs/"
];

export async function fetchFromIPFS(cid: string): Promise<any> {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000); // 4s par gateway

      const res = await fetch(`${gateway}${cid}`, {
        signal: controller.signal
      });

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
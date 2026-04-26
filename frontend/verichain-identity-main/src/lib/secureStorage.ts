const DB_NAME = "qsdid";
const STORE_NAME = "encryptedKeys";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface EncryptedMLDSA {
  ciphertext: string;   // base64url
  iv: string;           // base64url
  credentialId: string; // base64url de la passkey PRF associée
}

/**
 * Stocke la clé privée ML‑DSA chiffrée dans IndexedDB.
 * @param walletAddress identifiant unique de l'utilisateur (utilisé comme clé de stockage)
 */
export async function storeEncryptedMLDSAKey(
  walletAddress: string,
  data: EncryptedMLDSA
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.put(data, `mlDsa_${walletAddress}`);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Récupère la clé privée ML‑DSA chiffrée depuis IndexedDB.
 * @returns null si aucune donnée trouvée
 */
export async function loadEncryptedMLDSAKey(
  walletAddress: string
): Promise<EncryptedMLDSA | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(`mlDsa_${walletAddress}`);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Supprime la clé chiffrée (utile pour logout ou reset).
 */
export async function deleteEncryptedMLDSAKey(walletAddress: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.delete(`mlDsa_${walletAddress}`);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
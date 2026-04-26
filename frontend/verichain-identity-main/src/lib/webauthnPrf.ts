// Conversion base64url ↔ ArrayBuffer
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
}

/**
 * Crée une passkey (résidente) avec l’extension PRF.
 * @returns credentialId (base64url) et clé publique (base64url)
 */
export async function createPasskeyWithPRF(
  userId: string,
  userName: string,
  rpId: string = window.location.hostname
): Promise<{ credentialId: string; publicKey: string }> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBuffer = new TextEncoder().encode(userId);

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "QS·DID", id: rpId },
      user: { id: userIdBuffer, name: userName, displayName: userName },
      pubKeyCredParams: [{ type: "public-key", alg: -7 },{ type: "public-key", alg: -257 }], // ES256
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "required"
      },
      extensions: {
        prf: { eval: { first: new Uint8Array(32) } }
      }
    }
  })) as PublicKeyCredential;

  const credentialId = bufferToBase64Url(credential.rawId);
  // La clé publique n'est pas toujours accessible simplement, on renvoie une chaîne vide
  let pubKeyBase64 = "";
  if ("response" in credential && (credential.response as any).getPublicKey) {
    const pubKeyBuf = (credential.response as any).getPublicKey();
    pubKeyBase64 = bufferToBase64Url(pubKeyBuf);
  }
  return { credentialId, publicKey: pubKeyBase64 };
}

/**
 * Récupère la clé PRF (CryptoKey AES‑GCM) associée à une passkey existante.
 * Déclenche une validation utilisateur (biométrique / PIN).
 */
export async function getPRFKey(credentialId: string): Promise<CryptoKey> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const allowCredential: PublicKeyCredentialDescriptor = {
    id: base64UrlToBuffer(credentialId),
    type: "public-key"
  };

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [allowCredential],
      userVerification: "required",
      extensions: {
        prf: { eval: { first: new Uint8Array(32) } }
      }
    }
  })) as PublicKeyCredential;

  const clientExtResults = (assertion as any).getClientExtensionResults();
  const prfResult = clientExtResults?.prf;
  if (!prfResult?.results?.first) {
    throw new Error("PRF extension not supported or no key derived");
  }

  const rawKey = prfResult.results.first;
  if (!(rawKey instanceof ArrayBuffer)) {
    throw new Error("PRF key is not an ArrayBuffer");
  }

  // Importer la clé brute en tant que CryptoKey pour AES-GCM
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false, // non extractible (ne peut pas être exporté)
    ["encrypt", "decrypt"]
  );
  return cryptoKey;
}

/**
 * Détection de la disponibilité de l’extension PRF sur la plateforme.
 * Vérifie si un authentificateur de plateforme avec userVerification est disponible.
 */
export async function isPRFSupported(): Promise<boolean> {
  if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
    return false;
  }
  const isUVPA = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  return isUVPA;
}
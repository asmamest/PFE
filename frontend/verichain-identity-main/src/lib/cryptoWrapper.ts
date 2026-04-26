// Utilitaires base64url (réutilisés)
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
}

export async function encryptWithPRF(
  prfKey: CryptoKey,
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    prfKey,
    encoded
  );
  return {
    ciphertext: bufferToBase64Url(encrypted),
    iv: bufferToBase64Url(iv.buffer)
  };
}

export async function decryptWithPRF(
  prfKey: CryptoKey,
  ciphertextBase64: string,
  ivBase64: string
): Promise<string> {
  const ciphertext = base64UrlToBuffer(ciphertextBase64);
  const iv = base64UrlToBuffer(ivBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    prfKey,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}
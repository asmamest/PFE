// src/lib/qsdid/wasmClient.ts
/**
 * The ONLY interface to the QS-DID Rust backend.
 * All cryptography (ML-DSA-65 hybrid signing) goes through this WASM module.
 * Direct HTTP calls to the backend are forbidden.
 */
import { audit } from "./audit";

// Vite resolves this as a normal ES module import; the glue auto-fetches
// /wasm/qsdid_wasm_bg.wasm (patched in src/lib/wasm/qsdid_wasm.js).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - hand-written wasm-bindgen glue, no .d.ts shipped
import init, * as qs from "@/lib/wasm/qsdid_wasm.js";

const DEFAULT_API_BASE = "http://localhost:8083"; // Changé de 8081 à 8083

let initPromise: Promise<void> | null = null;
let ready = false;
let backendReady = false;
let currentApiBaseUrl = DEFAULT_API_BASE; // Ajouté

// wasmClient.ts
export interface HybridKeyPair {
  // Pour generateHybridKeys() (ancien backend)
  public_key?: string;
  private_key?: string;
  // Pour generateHybridKeysLocal()
  pq_public_key?: string;
  pq_secret_key?: string;
  classical_public_key?: string;
  classical_secret_key?: string;
  key_id?: string;
  [k: string]: unknown;
}

export interface SignatureResult {
  signature_id: string;
  signature?: string;
  algorithm?: string;
  created_at?: string;
  [k: string]: unknown;
}

export interface VerificationResult {
  valid: boolean;
  signature_id?: string;
  [k: string]: unknown;
}

export interface HealthResult {
  status?: string;
  version?: string;
  [k: string]: unknown;
}

export interface Challenge {
  challenge_id: string;
  nonce: string;
  expires_at: number;
}

/** Initialize the WASM module exactly once and configure the backend URL. */
export function initWasm(apiBaseUrl: string = DEFAULT_API_BASE): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await init();
      currentApiBaseUrl = apiBaseUrl;
      qs.set_api_base_url(apiBaseUrl);
      ready = true;
      audit("INFO", "WASM initialized", { apiBaseUrl });
    } catch (e) {
      audit("ERROR", "WASM initialization failed", { error: String(e) });
      initPromise = null;
      throw e;
    }
  })();
  return initPromise;
}

function ensureReady() {
  if (!ready) throw new Error("WASM module not initialized. Call initWasm() first.");
}

function getApiBaseUrl(): string {
  return currentApiBaseUrl;
}

/** Pings the Rust backend through WASM. Throws if unreachable. */
// src/lib/qsdid/wasmClient.ts

export async function healthCheck(): Promise<HealthResult> {
  ensureReady();
  try {
    const response = await fetch(`${getApiBaseUrl()}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    
    const res = await response.json();
    backendReady = true;
    audit("SUCCESS", "Backend health check passed", { status: res?.status });
    return res;
  } catch (e) {
    backendReady = false;
    audit("ERROR", "Backend unreachable", { error: String(e) });
    throw new Error(`Backend unavailable at ${getApiBaseUrl()}: ${(e as Error).message}`);
  }
}

export function isBackendReady() {
  return backendReady;
}

/** Generate a hybrid (classical + ML-DSA-65) keypair on the client. */
export async function generateHybridKeys(): Promise<HybridKeyPair> {
  ensureReady();
  audit("INFO", "Generating hybrid keys");
  const result = (await qs.generate_hybrid_keys()) as HybridKeyPair;
  audit("SUCCESS", "Keys generated", {
    publicKeyPreview: typeof result?.public_key === "string" ? result.public_key.slice(0, 24) + "…" : undefined,
  });
  return result;
}

/** Demander un challenge au backend */
export async function getChallenge(context: string): Promise<Challenge> {
  ensureReady();
  audit("INFO", "Requesting challenge", { context });
  
  const response = await fetch(`${getApiBaseUrl()}/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get challenge: ${response.status} - ${errorText}`);
  }
  
  const challenge = await response.json();
  audit("SUCCESS", "Challenge received", { challenge_id: challenge.challenge_id });
  return challenge;
}

export async function signWithPrivateKeyHex(
  documentB64: string,
  pqSecretHex: string,
  classicalSecretHex: string
): Promise<SignatureResult> {
  ensureReady();
  const result = await qs.sign_with_private_key_hex(documentB64, pqSecretHex, classicalSecretHex);
  return result as SignatureResult;
}

export async function generateHybridKeysLocal(): Promise<any> {
  ensureReady();
  return await qs.generate_hybrid_keys_local();
}

/** Signer un document avec l'ID de challenge (NOUVELLE FONCTION) */
export async function signDocumentWithChallenge(documentB64: string, challengeId: string): Promise<SignatureResult> {
  ensureReady();
  audit("INFO", "Signing requested with challenge", { challengeId });
  
  const response = await fetch(`${getApiBaseUrl()}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document: documentB64,
      challenge_id: challengeId
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Signing failed: ${response.status} - ${error}`);
  }
  
  const res = await response.json();
  audit("SUCCESS", "Signature created", { signature_id: res?.signature_id });
  return res;
}

/** Sign a base64-encoded document via real ML-DSA backend. (GARDÉE pour compatibilité) */
export async function signDocument(documentB64: string): Promise<SignatureResult> {
  ensureReady();
  audit("INFO", "Signing requested");
  const res = (await qs.sign_document(documentB64)) as SignatureResult;
  audit("SUCCESS", "Signature created", { signature_id: res?.signature_id });
  return res;
}

/** Verify a signature against a base64-encoded document via real ML-DSA backend. */


export async function verifySignature(signatureId: string, documentB64: string): Promise<VerificationResult> {
  ensureReady();
  
  console.log("🔍 VERIFY Request:", {
    signature_id: signatureId,
    document_length: documentB64.length
  });
  
  const response = await fetch(`${getApiBaseUrl()}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signature_id: signatureId,
      document: documentB64
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Verification failed: ${response.status} - ${errorText}`);
  }
  
  const res = await response.json();
  
  if (res?.valid) {
    audit("SUCCESS", "Verification passed", { signature_id: signatureId });
  } else {
    audit("ERROR", "Verification failed", { signature_id: signatureId, result: res });
  }
  
  return res;
}

/** Encode a UTF-8 string as base64 (browser-safe). */
export function encodeUtf8ToB64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Cryptographically random base64url nonce. */
export function generateChallengeNonce(byteLen = 32): string {
  const buf = new Uint8Array(byteLen);
  crypto.getRandomValues(buf);
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
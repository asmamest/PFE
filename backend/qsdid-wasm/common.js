// common.js - Fonctions partagées entre Alice et École

// Configuration de l'API
let API_BASE_URL = "http://localhost:8083";

export function setApiBaseUrl(url) {
    API_BASE_URL = url;
}

export function getApiBaseUrl() {
    return API_BASE_URL;
}

// Appels API génériques
export async function apiCall(endpoint, method = "GET", body = null) {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
        method: method,
        headers: {
            "Content-Type": "application/json",
        },
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    return response.json();
}

// Signatures
export async function generateHybridKeys() {
    return apiCall("/keys/generate", "POST");
}

export async function signDocument(documentB64) {
    return apiCall("/sign", "POST", { document: documentB64 });
}

export async function verifySignature(signatureId, documentB64) {
    return apiCall("/verify", "POST", { signature_id: signatureId, document: documentB64 });
}

export async function getSignature(signatureId) {
    return apiCall(`/signatures/${signatureId}`, "GET");
}

export async function listSignatures() {
    return apiCall("/signatures", "GET");
}

// KEM
export async function generateKemKeys() {
    return apiCall("/kem/generate", "POST");
}

export async function kemEncrypt(publicKeyHex, plaintextB64) {
    return apiCall("/kem/encrypt", "POST", { public_key: publicKeyHex, plaintext: plaintextB64 });
}

export async function kemDecrypt(secretKeyHex, kemCiphertextHex, encryptedDataB64, nonceHex) {
    return apiCall("/kem/decrypt", "POST", {
        secret_key: secretKeyHex,
        kem_ciphertext: kemCiphertextHex,
        encrypted_data: encryptedDataB64,
        nonce: nonceHex,
    });
}

// Utilitaires
export async function healthCheck() {
    return apiCall("/health", "GET");
}

export async function getStats() {
    return apiCall("/stats", "GET");
}

export function hashDocument(document) {
    // Simuler un hash (en réalité appel WASM)
    return "hash_" + Math.random().toString(36);
}

export function generateId() {
    return Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

export function formatDate() {
    return new Date().toISOString();
}

export function log(message, type = "info", elementId) {
    const logArea = document.getElementById(elementId);
    if (!logArea) return;
    
    const entry = document.createElement("div");
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
    logArea.appendChild(entry);
    entry.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
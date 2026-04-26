import { logger } from '../utils/logger.js';

let wasmModule = null;
let wasmInitialized = false;

const API_BASE_URL = process.env.QSDID_API_URL || 'http://localhost:8082';

// Fonctions qui utilisent le WASM (pour les opérations non-réseau)
export async function hashDocument(data) {
  const wasm = await getWasm();
  return wasm.hash_document(data);
}

export async function toBase64(data) {
  const wasm = await getWasm();
  return wasm.to_base64(data);
}

export async function fromBase64(str) {
  const wasm = await getWasm();
  return wasm.from_base64(str);
}

export async function generateId() {
  const wasm = await getWasm();
  return wasm.generate_id();
}

async function getWasm() {
  if (wasmModule && wasmInitialized) {
    return wasmModule;
  }

  try {
    logger.info('Loading WASM module for utilities...');
    const wasm = await import('../../../qsdid-wasm/pkg/qsdid_wasm.js');
    
    if (wasm.init && typeof wasm.init === 'function') {
      await wasm.init();
    }
    
    wasmModule = wasm;
    wasmInitialized = true;
    logger.info('✅ WASM module loaded for utilities');
    return wasmModule;
  } catch (error) {
    logger.error('❌ Failed to load WASM:', error.message);
    throw error;
  }
}

// Client principal avec HTTP direct (pas de WASM pour les appels réseau)
export class PQCClient {
  static async getInstance() {
    logger.info(`✅ Using direct HTTP client to ${API_BASE_URL}`);
    return { direct: true, apiUrl: API_BASE_URL };
  }

  static async sign(claims, privateKey, options = {}) {
    const { retries = 2 } = options;
    const startTime = Date.now();

    if (!claims || typeof claims !== 'object') {
      throw new Error('Invalid claims: must be an object');
    }

    const claimsJson = JSON.stringify(claims);
    const claimsBase64 = Buffer.from(claimsJson).toString('base64');

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        logger.debug(`Signing attempt ${attempt + 1}...`);
        
        const response = await fetch(`${API_BASE_URL}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document: claimsBase64 })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        const duration = Date.now() - startTime;
        logger.info(`✅ Signature created in ${duration}ms`);
        
        // Retourner la signature JSON (string)
        return result.signature_json || result.signature;
      } catch (error) {
        logger.warn(`⚠️ Signing attempt ${attempt + 1} failed: ${error.message}`);
        
        if (attempt === retries) {
          logger.error(`❌ Signature failed after ${retries + 1} attempts`);
          throw new Error(`PQ signing failed: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  static async verify(claims, signature, publicKey, options = {}) {
    const { retries = 2, throwOnFailure = false } = options;

    if (!claims || typeof claims !== 'object') {
      if (throwOnFailure) throw new Error('Invalid claims');
      return false;
    }

    const claimsJson = JSON.stringify(claims);
    const claimsBase64 = Buffer.from(claimsJson).toString('base64');

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${API_BASE_URL}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            signature_id: signature, 
            document: claimsBase64 
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        const isValid = result.valid === true;
        logger.debug(`✅ Verification result: ${isValid}`);
        return isValid;
      } catch (error) {
        logger.warn(`⚠️ Verification attempt ${attempt + 1} failed: ${error.message}`);
        
        if (attempt === retries) {
          if (throwOnFailure) {
            throw new Error(`PQ verification failed: ${error.message}`);
          }
          return false;
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  static async generateHybridKeyPair(did) {
    try {
      const response = await fetch(`${API_BASE_URL}/keys/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ did: did || 'unknown' })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      logger.info(`✅ Hybrid key pair generated for ${did}`);
      return {
        public_key: result.pq_public_key,
        private_key: result.key_id,
        algorithm: 'ML-DSA-65+Ed25519'
      };
    } catch (error) {
      logger.error(`❌ Key generation failed:`, error.message);
      throw error;
    }
  }

  static async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const result = await response.json();
      return {
        status: 'up',
        module: 'hybrid-wasm-http',
        api_url: API_BASE_URL,
        api_status: result.status
      };
    } catch (error) {
      return { status: 'down', reason: error.message, api_url: API_BASE_URL };
    }
  }
}

export default PQCClient;

//! Hybrid Signer with Weak Non-Separability (WNS) - Production Ready
//!
//! Implements composite signatures combining ML-DSA-65 (post-quantum) and   (classical)
//! with strong cryptographic binding (WNS) to prevent stripping attacks.

use pqc_ml_dsa::PqcSigner;
use ed25519_dalek::{SigningKey, VerifyingKey, Signature as Ed25519Signature, Signer, Verifier};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Serialize, Deserialize};
use anyhow::Result;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

// ============================================================================
// Composite Key & Algorithm ID (compatible with IOTA's format)
// ============================================================================

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[non_exhaustive]
pub enum CompositeAlgId {
    #[serde(rename = "id-MLDSA44-Ed25519")]
    IdMldsa44Ed25519,
    #[serde(rename = "id-MLDSA65-Ed25519")]
    IdMldsa65Ed25519,
}

impl CompositeAlgId {
    pub fn name(&self) -> &'static str {
        match self {
            Self::IdMldsa44Ed25519 => "id-MLDSA44-Ed25519",
            Self::IdMldsa65Ed25519 => "id-MLDSA65-Ed25519",
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomCompositeJwk {
    pub alg_id: CompositeAlgId,
    pub traditional_public_key: Vec<u8>,   // Ed25519 public key (32 bytes)
    pub pq_public_key: Vec<u8>,            // ML-DSA-65 public key (1952 bytes)
}

// ============================================================================
// Error Types
// ============================================================================

#[derive(Error, Debug, Clone, PartialEq)]
pub enum HybridError {
    #[error("Invalid composite signature format")]
    InvalidFormat,
    #[error("Post-quantum signature verification failed: {0}")]
    PqVerificationFailed(String),
    #[error("Classical signature verification failed")]
    ClassicalVerificationFailed,
    #[error("Document hash mismatch – possible tampering")]
    HashMismatch,
    #[error("Signature timestamp is too old or in the future (replay protection)")]
    TimestampValidationFailed,
    #[error("Algorithm mismatch: expected {expected}, got {actual}")]
    AlgorithmMismatch { expected: String, actual: String },
    #[error("Weak Non-Separability violation – signatures are not cryptographically bound")]
    WnsViolation,
    #[error("Key conversion error: {0}")]
    KeyConversionError(String),
    #[error("Entropy mismatch – signature context altered")]
    EntropyMismatch,
}

// ============================================================================
// Composite Signature
// ============================================================================

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CompositeSignature {
    pub classical_signature: Vec<u8>,     // Ed25519 signature (64 bytes)
    pub pq_signature: Vec<u8>,            // ML-DSA-65 signature (~3309 bytes)
    pub algorithm: CompositeAlgId,
    pub timestamp: u64,
    pub binding_hash: [u8; 32],           // Blake3(pq_sig || classical_sig)
    pub document_hash: [u8; 32],          // Blake3(original message)
    pub entropy: [u8; 16],                // Random nonce for context binding
}

// ============================================================================
// Local Key Pair Storage (for serialization)
// ============================================================================

#[derive(Serialize, Deserialize, Clone)]
pub struct HybridKeyPair {
    pub pq_public_key: Vec<u8>,
    pub pq_secret_key: Vec<u8>,
    pub classical_public_key: Vec<u8>,
    pub classical_secret_key: Vec<u8>,
    pub key_id: String,
    pub created_at: u64,
}

// ============================================================================
// Hybrid Signer (holds secret keys)
// ============================================================================

pub struct HybridSigner {
    pq_signer: PqcSigner,
    classical_signer: SigningKey,
    classical_verifying_key: VerifyingKey,
    key_id: String,
}

impl HybridSigner {
    /// Generate a new hybrid key pair (ML-DSA-65 + Ed25519).
    pub fn generate() -> Result<Self> {
        let pq_signer = PqcSigner::generate()?;
        let mut csprng = OsRng;
        let classical_signer = SigningKey::generate(&mut csprng);
        let classical_verifying_key = classical_signer.verifying_key();
        let key_id = Self::generate_key_id(&pq_signer, &classical_verifying_key);
        Ok(Self {
            pq_signer,
            classical_signer,
            classical_verifying_key,
            key_id,
        })
    }

    fn generate_key_id(pq_signer: &PqcSigner, classical_key: &VerifyingKey) -> String {
        let mut hasher = blake3::Hasher::new();
        hasher.update(pq_signer.public_key_bytes());
        hasher.update(classical_key.as_bytes());
        hex::encode(hasher.finalize().as_bytes())
    }

    /// Create linked context for PQ signature (includes both public keys and entropy).
    fn create_linked_context(&self, doc_hash: &[u8; 32], entropy: &[u8; 16]) -> Vec<u8> {
        let mut ctx = Vec::new();
        ctx.extend_from_slice(b"QSDID-HYBRID-v1");
        ctx.extend_from_slice(doc_hash);
        ctx.extend_from_slice(entropy);
        ctx.extend_from_slice(self.classical_verifying_key.as_bytes());
        ctx.extend_from_slice(self.pq_signer.public_key_bytes());
        ctx
    }

    /// Create message for classical signature (includes PQ signature for binding).
    fn create_classical_message(&self, doc_hash: &[u8; 32], pq_sig: &[u8], entropy: &[u8; 16]) -> Vec<u8> {
        let mut msg = Vec::new();
        msg.extend_from_slice(b"CLASSIC-WRAPPER-v1");
        msg.extend_from_slice(doc_hash);
        msg.extend_from_slice(pq_sig);
        msg.extend_from_slice(entropy);
        msg.extend_from_slice(self.classical_verifying_key.as_bytes());
        msg
    }

    /// Generate cryptographically secure random entropy.
    fn generate_entropy(&self) -> [u8; 16] {
        let mut entropy = [0u8; 16];
        OsRng.fill_bytes(&mut entropy);
        entropy
    }

    /// Sign a message and produce a composite signature.
    pub fn sign_composite(&self, message: &[u8]) -> Result<CompositeSignature> {
        let doc_hash = blake3::hash(message);
        let doc_hash_bytes = doc_hash.as_bytes();
        let entropy = self.generate_entropy();

        // 1. Post‑quantum signature on the linked context
        let context = self.create_linked_context(doc_hash_bytes, &entropy);
        let pq_signature = self.pq_signer.sign(&context)?;

        // 2. Classical signature on a message that includes the PQ signature (strong binding)
        let classical_msg = self.create_classical_message(doc_hash_bytes, &pq_signature, &entropy);
        let classical_signature = self.classical_signer.sign(&classical_msg);

        // 3. Binding hash to enforce Weak Non‑Separability
        let mut hasher = blake3::Hasher::new();
        hasher.update(&pq_signature);
        hasher.update(classical_signature.to_bytes().as_ref());
        let binding_hash = hasher.finalize().into();

        Ok(CompositeSignature {
            classical_signature: classical_signature.to_bytes().to_vec(),
            pq_signature,
            algorithm: CompositeAlgId::IdMldsa65Ed25519,
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs(),
            binding_hash,
            document_hash: *doc_hash_bytes,
            entropy,
        })
    }

    /// Export public keys as a custom composite JWK (compatible with IOTA's format).
    pub fn export_composite_jwk(&self) -> CustomCompositeJwk {
        CustomCompositeJwk {
            alg_id: CompositeAlgId::IdMldsa65Ed25519,
            traditional_public_key: self.classical_verifying_key.as_bytes().to_vec(),
            pq_public_key: self.pq_signer.public_key_bytes().to_vec(),
        }
    }

    /// Get raw key pair for secure storage (e.g., encrypted file).
    pub fn get_key_pair(&self) -> HybridKeyPair {
        HybridKeyPair {
            pq_public_key: self.pq_signer.public_key_bytes().to_vec(),
            pq_secret_key: self.pq_signer.secret_key_bytes().to_vec(),
            classical_public_key: self.classical_verifying_key.as_bytes().to_vec(),
            classical_secret_key: self.classical_signer.to_bytes().to_vec(),
            key_id: self.key_id.clone(),
            created_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
        }
    }

    pub fn key_id(&self) -> &str {
        &self.key_id
    }

    /// Reconstruct a signer from a key pair (secret keys + public keys)
    pub fn from_key_pair(key_pair: &HybridKeyPair) -> Result<Self> {
        let pq_signer = PqcSigner::from_secret_key(key_pair.pq_secret_key.clone(), key_pair.pq_public_key.clone())
            .map_err(|e| anyhow::anyhow!("Failed to load PQ signer: {}", e))?;
        let classical_signer = SigningKey::from_bytes(key_pair.classical_secret_key.as_slice().try_into()
            .map_err(|_| anyhow::anyhow!("Invalid classical secret key length"))?);
        let classical_verifying_key = classical_signer.verifying_key();
        Ok(Self {
            pq_signer,
            classical_signer,
            classical_verifying_key,
            key_id: key_pair.key_id.clone(),
        })
    }

    pub fn from_private_keys_hex(pq_secret_hex: &str, classical_secret_hex: &str) -> Result<Self> {
        let pq_secret_bytes = hex::decode(pq_secret_hex)
            .map_err(|e| anyhow::anyhow!("Invalid PQ secret hex: {}", e))?;
        let classical_secret_bytes = hex::decode(classical_secret_hex)
            .map_err(|e| anyhow::anyhow!("Invalid classical secret hex: {}", e))?;
        
        // Reconstruire le signeur PQ
        let pq_signer = PqcSigner::from_secret_key(pq_secret_bytes, vec![])
            .map_err(|e| anyhow::anyhow!("PQ signer error: {}", e))?;
        
        // Reconstruire le signeur classique
        let classical_signer = SigningKey::from_bytes(
            classical_secret_bytes.as_slice().try_into()
                .map_err(|_| anyhow::anyhow!("Invalid classical secret key length"))?
        );
        let classical_verifying_key = classical_signer.verifying_key();
        
        let key_id = Self::generate_key_id(&pq_signer, &classical_verifying_key);
        
        Ok(Self {
            pq_signer,
            classical_signer,
            classical_verifying_key,
            key_id,
        })
    }

}

// ============================================================================
// Hybrid Verifier (holds only public keys)
// ============================================================================

pub struct HybridVerifier {
    pq_verifier: PqcSigner,
    classical_verifying_key: VerifyingKey,
    key_id: String,
}

impl HybridVerifier {
    /// Build a verifier from a custom composite JWK.
    pub fn from_composite_jwk(jwk: &CustomCompositeJwk) -> Result<Self, HybridError> {
        let pq_verifier = PqcSigner::from_public_key(jwk.pq_public_key.clone())
            .map_err(|e| HybridError::PqVerificationFailed(e.to_string()))?;
        let classical_key_bytes: [u8; 32] = jwk.traditional_public_key.as_slice().try_into()
            .map_err(|_| HybridError::ClassicalVerificationFailed)?;
        let classical_verifying_key = VerifyingKey::from_bytes(&classical_key_bytes)
            .map_err(|_| HybridError::ClassicalVerificationFailed)?;
        Ok(Self {
            pq_verifier,
            classical_verifying_key,
            key_id: jwk.alg_id.name().to_string(),
        })
    }

    /// Build a verifier from raw public key bytes (useful for testing).
    pub fn from_raw_bytes(pq_public_key: Vec<u8>, classical_public_key: Vec<u8>) -> Result<Self, HybridError> {
        let pq_verifier = PqcSigner::from_public_key(pq_public_key)
            .map_err(|e| HybridError::PqVerificationFailed(e.to_string()))?;
        let classical_key_bytes: [u8; 32] = classical_public_key.as_slice().try_into()
            .map_err(|_| HybridError::ClassicalVerificationFailed)?;
        let classical_verifying_key = VerifyingKey::from_bytes(&classical_key_bytes)
            .map_err(|_| HybridError::ClassicalVerificationFailed)?;
        Ok(Self {
            pq_verifier,
            classical_verifying_key,
            key_id: "raw".to_string(),
        })
    }

    // Helper methods – must be identical to those in HybridSigner
    fn create_linked_context(&self, doc_hash: &[u8; 32], entropy: &[u8; 16]) -> Vec<u8> {
        let mut ctx = Vec::new();
        ctx.extend_from_slice(b"QSDID-HYBRID-v1");
        ctx.extend_from_slice(doc_hash);
        ctx.extend_from_slice(entropy);
        ctx.extend_from_slice(self.classical_verifying_key.as_bytes());
        ctx.extend_from_slice(self.pq_verifier.public_key_bytes());
        ctx
    }

    fn create_classical_message(&self, doc_hash: &[u8; 32], pq_sig: &[u8], entropy: &[u8; 16]) -> Vec<u8> {
        let mut msg = Vec::new();
        msg.extend_from_slice(b"CLASSIC-WRAPPER-v1");
        msg.extend_from_slice(doc_hash);
        msg.extend_from_slice(pq_sig);
        msg.extend_from_slice(entropy);
        msg.extend_from_slice(self.classical_verifying_key.as_bytes());
        msg
    }

    /// Verify a composite signature.
    pub fn verify_composite(&self, message: &[u8], signature: &CompositeSignature) -> Result<bool, HybridError> {
        // Algorithm check
        if signature.algorithm != CompositeAlgId::IdMldsa65Ed25519 {
            return Err(HybridError::AlgorithmMismatch {
                expected: CompositeAlgId::IdMldsa65Ed25519.name().to_string(),
                actual: signature.algorithm.name().to_string(),
            });
        }

        // Timestamp check (5 minutes tolerance)
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        if now > signature.timestamp + 300 {
            return Err(HybridError::TimestampValidationFailed);
        }

        // Document hash integrity
        let current_doc_hash = blake3::hash(message);
        if current_doc_hash.as_bytes() != &signature.document_hash {
            return Err(HybridError::HashMismatch);
        }

        // Binding hash verification (Weak Non‑Separability)
        let mut hasher = blake3::Hasher::new();
        hasher.update(&signature.pq_signature);
        hasher.update(&signature.classical_signature);
        let recomputed_binding: [u8; 32] = hasher.finalize().into();
        if recomputed_binding != signature.binding_hash {
            return Err(HybridError::WnsViolation);
        }

        // Recreate contexts using the stored entropy
        let context = self.create_linked_context(&signature.document_hash, &signature.entropy);
        let classical_msg = self.create_classical_message(&signature.document_hash, &signature.pq_signature, &signature.entropy);

        // Verify post‑quantum signature
        let pq_ok = self
            .pq_verifier
            .verify_with_public_key(&context, &signature.pq_signature)
            .map_err(|e| HybridError::PqVerificationFailed(e.to_string()))?;

        // Verify classical signature
        let classical_sig = Ed25519Signature::from_bytes(
            signature.classical_signature.as_slice().try_into()
                .map_err(|_| HybridError::ClassicalVerificationFailed)?,
        );
        let classical_ok = self.classical_verifying_key.verify(&classical_msg, &classical_sig).is_ok();

        Ok(pq_ok && classical_ok)
    }

    pub fn key_id(&self) -> &str {
        &self.key_id
    }
}

// ============================================================================
// Serialization Helpers
// ============================================================================

impl CompositeSignature {
    /// Serialize the signature to compact JSON (for storage or transmission).
    pub fn to_json(&self) -> Result<String> {
        Ok(serde_json::to_string(self)?)
    }

    /// Deserialize a signature from JSON.
    pub fn from_json(json: &str) -> Result<Self> {
        Ok(serde_json::from_str(json)?)
    }
}

// ============================================================================
// Unit Tests (Production‑ready)
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_workflow() {
        let signer = HybridSigner::generate().unwrap();
        let jwk = signer.export_composite_jwk();
        let message = b"Production test message - sign me!";
        let signature = signer.sign_composite(message).unwrap();
        let verifier = HybridVerifier::from_composite_jwk(&jwk).unwrap();
        assert!(verifier.verify_composite(message, &signature).unwrap());
        println!("✅ Full workflow OK");
    }

    #[test]
    fn tampered_message_fails() {
        let signer = HybridSigner::generate().unwrap();
        let jwk = signer.export_composite_jwk();
        let original = b"Original important document";
        let tampered = b"Tampered document";
        let signature = signer.sign_composite(original).unwrap();
        let verifier = HybridVerifier::from_composite_jwk(&jwk).unwrap();
        let result = verifier.verify_composite(tampered, &signature);
        assert!(matches!(result, Err(HybridError::HashMismatch)));
        println!("✅ Tampered message correctly rejected");
    }

    #[test]
    fn modified_binding_hash_fails() {
        let signer = HybridSigner::generate().unwrap();
        let jwk = signer.export_composite_jwk();
        let message = b"Message with strong binding";
        let mut signature = signer.sign_composite(message).unwrap();
        signature.binding_hash[0] ^= 0xFF;
        let verifier = HybridVerifier::from_composite_jwk(&jwk).unwrap();
        let result = verifier.verify_composite(message, &signature);
        assert!(matches!(result, Err(HybridError::WnsViolation)));
        println!("✅ Binding hash tampering detected");
    }

    #[test]
    fn expired_signature_fails() {
        let signer = HybridSigner::generate().unwrap();
        let jwk = signer.export_composite_jwk();
        let message = b"Old document";
        let mut signature = signer.sign_composite(message).unwrap();
        signature.timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() - 600;
        let verifier = HybridVerifier::from_composite_jwk(&jwk).unwrap();
        let result = verifier.verify_composite(message, &signature);
        assert!(matches!(result, Err(HybridError::TimestampValidationFailed)));
        println!("✅ Expired signature rejected");
    }

    #[test]
    fn serialization_roundtrip() {
        let signer = HybridSigner::generate().unwrap();
        let message = b"Test serialization";
        let original = signer.sign_composite(message).unwrap();
        let json = original.to_json().unwrap();
        let deserialized = CompositeSignature::from_json(&json).unwrap();
        assert_eq!(original.classical_signature, deserialized.classical_signature);
        assert_eq!(original.pq_signature, deserialized.pq_signature);
        assert_eq!(original.binding_hash, deserialized.binding_hash);
        assert_eq!(original.document_hash, deserialized.document_hash);
        assert_eq!(original.entropy, deserialized.entropy);
        println!("✅ JSON serialization roundtrip OK");
    }
}
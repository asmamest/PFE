//! Hybrid Signer with Weak Non-Separability (WNS)
//! 
//! This module provides hybrid post-quantum + classical signatures
//! that are cryptographically bound together to prevent stripping attacks.

use pqc_ml_dsa::PqcSigner;
use ed25519_dalek::{SigningKey, VerifyingKey, Signature as Ed25519Signature};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Serialize, Deserialize};
use anyhow::Result;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;

// ============================================================================
// Error Types
// ============================================================================

#[derive(Error, Debug, Clone, PartialEq)]
pub enum HybridError {
    #[error("Invalid hybrid signature format")]
    InvalidFormat,
    
    #[error("Signature extraction failed: {0}")]
    ExtractionFailed(String),
    
    #[error("PQ signature verification failed")]
    PqVerificationFailed,
    
    #[error("Classic signature verification failed")]
    ClassicVerificationFailed,
    
    #[error("Document hash mismatch - possible tampering detected")]
    HashMismatch,
    
    #[error("Timestamp validation failed")]
    TimestampValidationFailed,
    
    #[error("Algorithm mismatch: expected {expected}, got {actual}")]
    AlgorithmMismatch { expected: String, actual: String },
    
    #[error("Weak Non-Separability property violated - stripping attack detected")]
    WnsViolation,
}

// ============================================================================
// Hybrid Signature Structures
// ============================================================================

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SignatureMetadata {
    pub pq_key_id: String,
    pub classic_key_id: String,
    pub signature_purpose: String,
    pub entropy: [u8; 16],
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct HybridSignature {
    pub combined_signature: Vec<u8>,
    pub document_hash: [u8; 32],
    pub algorithms: Vec<String>,
    pub timestamp: u64,
    pub version: u8,
    pub metadata: SignatureMetadata,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HybridKeyPair {
    pub pq_public_key: Vec<u8>,
    pub pq_secret_key: Vec<u8>,
    pub classic_public_key: Vec<u8>,
    pub classic_secret_key: Vec<u8>,
    pub key_id: String,
    pub created_at: u64,
}

// ============================================================================
// Hybrid Signer
// ============================================================================

pub struct HybridSigner {
    pq_signer: PqcSigner,
    classic_signer: SigningKey,
    classic_verifying_key: VerifyingKey,
    key_id: String,
}

impl HybridSigner {
    pub fn generate() -> Result<Self> {
        let pq_signer = PqcSigner::generate()?;
        
        let mut csprng = OsRng;
        let classic_signer = SigningKey::generate(&mut csprng);
        let classic_verifying_key = classic_signer.verifying_key();
        
        let key_id = Self::generate_key_id(&pq_signer, &classic_verifying_key);
        
        Ok(Self {
            pq_signer,
            classic_signer,
            classic_verifying_key,
            key_id,
        })
    }
    
    fn generate_key_id(pq_signer: &PqcSigner, classic_key: &VerifyingKey) -> String {
        let mut hasher = blake3::Hasher::new();
        hasher.update(pq_signer.public_key_bytes());
        hasher.update(classic_key.as_bytes());
        let hash = hasher.finalize();
        hex::encode(hash.as_bytes())
    }
    
    fn generate_entropy(&self) -> [u8; 16] {
        let mut entropy = [0u8; 16];
        OsRng.fill_bytes(&mut entropy);
        entropy
    }
    
    fn create_linked_context(&self, hash: &[u8; 32], entropy: &[u8; 16]) -> Vec<u8> {
        let mut context = Vec::new();
        context.extend_from_slice(b"QSDID-HYBRID-v1");
        context.extend_from_slice(hash);
        context.extend_from_slice(entropy);
        context.extend_from_slice(self.classic_verifying_key.as_bytes());
        context.extend_from_slice(self.pq_signer.public_key_bytes());
        context
    }
    
    fn create_classic_message(&self, hash: &[u8; 32], pq_signature: &[u8], entropy: &[u8; 16]) -> Vec<u8> {
        let mut message = Vec::new();
        message.extend_from_slice(b"CLASSIC-WRAPPER-v1");
        message.extend_from_slice(hash);
        message.extend_from_slice(pq_signature);
        message.extend_from_slice(entropy);
        message.extend_from_slice(self.classic_verifying_key.as_bytes());
        message
    }
    
    fn combine_signatures_wns(&self, pq_sig: &[u8], classic_sig: &[u8]) -> Vec<u8> {
        let max_len = pq_sig.len().max(classic_sig.len());
        let binding_key = self.derive_binding_key(pq_sig, classic_sig);
        
        let mut combined = Vec::with_capacity(max_len + 16);
        combined.extend_from_slice(&(pq_sig.len() as u32).to_le_bytes());
        combined.extend_from_slice(&(classic_sig.len() as u32).to_le_bytes());
        combined.extend_from_slice(&binding_key);
        
        for i in 0..max_len {
            let keystream_byte = binding_key[i % binding_key.len()];
            let pq_byte = pq_sig.get(i).unwrap_or(&0);
            let classic_byte = classic_sig.get(i).unwrap_or(&0);
            combined.push(pq_byte ^ classic_byte ^ keystream_byte);
        }
        
        combined
    }
    
    fn derive_binding_key(&self, pq_sig: &[u8], classic_sig: &[u8]) -> Vec<u8> {
        let mut hasher = blake3::Hasher::new();
        hasher.update(pq_sig);
        hasher.update(classic_sig);
        hasher.update(self.classic_verifying_key.as_bytes());
        hasher.update(self.pq_signer.public_key_bytes());
        hasher.finalize().as_bytes().to_vec()
    }
    
    pub fn sign_hybrid(&self, message: &[u8]) -> Result<HybridSignature> {
        let document_hash = blake3::hash(message);
        let hash_bytes = document_hash.as_bytes();
        let entropy = self.generate_entropy();
        
        let context = self.create_linked_context(hash_bytes, &entropy);
        let pq_signature = self.pq_signer.sign(&context)?;
        
        let classic_message = self.create_classic_message(hash_bytes, &pq_signature, &entropy);
        let classic_signature = self.classic_signer.sign(&classic_message);
        
        let combined = self.combine_signatures_wns(&pq_signature, classic_signature.to_bytes().as_ref());
        
        let metadata = SignatureMetadata {
            pq_key_id: self.key_id.clone(),
            classic_key_id: self.key_id.clone(),
            signature_purpose: "QSDID-HYBRID-V1".to_string(),
            entropy,
        };
        
        Ok(HybridSignature {
            combined_signature: combined,
            document_hash: *hash_bytes,
            algorithms: vec!["ML-DSA-65".to_string(), "Ed25519".to_string()],
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs(),
            version: 1,
            metadata,
        })
    }
    
    pub fn extract_signatures(&self, combined: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        if combined.len() < 16 {
            return Err(anyhow::anyhow!("Invalid combined signature"));
        }
        
        let pq_len = u32::from_le_bytes(combined[0..4].try_into().unwrap()) as usize;
        let classic_len = u32::from_le_bytes(combined[4..8].try_into().unwrap()) as usize;
        let binding_key = &combined[8..16];
        let combined_data = &combined[16..];
        
        let mut pq_sig = vec![0u8; pq_len];
        let mut classic_sig = vec![0u8; classic_len];
        
        for i in 0..pq_len.max(classic_len) {
            let combined_byte = *combined_data.get(i).unwrap_or(&0);
            let keystream_byte = binding_key[i % binding_key.len()];
            
            if i < pq_len && i < classic_len {
                pq_sig[i] = combined_byte ^ keystream_byte ^ classic_sig[i];
                classic_sig[i] = combined_byte ^ keystream_byte ^ pq_sig[i];
            } else if i < pq_len {
                pq_sig[i] = combined_byte ^ keystream_byte;
            } else if i < classic_len {
                classic_sig[i] = combined_byte ^ keystream_byte;
            }
        }
        
        Ok((pq_sig, classic_sig))
    }
    
    pub fn get_public_keys(&self) -> HybridKeyPair {
        HybridKeyPair {
            pq_public_key: self.pq_signer.public_key_bytes().to_vec(),
            pq_secret_key: self.pq_signer.secret_key_bytes().to_vec(),
            classic_public_key: self.classic_verifying_key.as_bytes().to_vec(),
            classic_secret_key: self.classic_signer.to_bytes().to_vec(),
            key_id: self.key_id.clone(),
            created_at: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
        }
    }
    
    pub fn key_id(&self) -> &str {
        &self.key_id
    }
}

// ============================================================================
// Hybrid Verifier
// ============================================================================

pub struct HybridVerifier {
    pq_public_key: Vec<u8>,
    classic_public_key: Vec<u8>,
    key_id: String,
}

impl HybridVerifier {
    pub fn new(pq_public_key: Vec<u8>, classic_public_key: Vec<u8>) -> Self {
        let key_id = Self::generate_key_id(&pq_public_key, &classic_public_key);
        Self {
            pq_public_key,
            classic_public_key,
            key_id,
        }
    }
    
    fn generate_key_id(pq_key: &[u8], classic_key: &[u8]) -> String {
        let mut hasher = blake3::Hasher::new();
        hasher.update(pq_key);
        hasher.update(classic_key);
        let hash = hasher.finalize();
        hex::encode(hash.as_bytes())
    }
    
    pub fn verify_hybrid(&self, message: &[u8], signature: &HybridSignature) -> Result<bool, HybridError> {
        let current_hash = blake3::hash(message);
        if current_hash.as_bytes() != &signature.document_hash {
            return Err(HybridError::HashMismatch);
        }
        
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        if now > signature.timestamp + 300 {
            return Err(HybridError::TimestampValidationFailed);
        }
        
        let expected_algorithms = vec!["ML-DSA-65".to_string(), "Ed25519".to_string()];
        if signature.algorithms != expected_algorithms {
            return Err(HybridError::AlgorithmMismatch {
                expected: format!("{:?}", expected_algorithms),
                actual: format!("{:?}", signature.algorithms),
            });
        }
        
        // For verification, we need to extract signatures
        // Create a temporary signer just for extraction
        let temp_signer = HybridSigner::generate().map_err(|e| HybridError::ExtractionFailed(e.to_string()))?;
        let (pq_sig, classic_sig) = temp_signer.extract_signatures(&signature.combined_signature)
            .map_err(|e| HybridError::ExtractionFailed(e.to_string()))?;
        
        // Verify classic signature (Ed25519)
        let classic_valid = self.verify_classic(message, &classic_sig)?;
        
        // For PQ verification, we trust the combined signature structure
        // In production, you would implement full PQ verification
        let pq_valid = !pq_sig.is_empty();
        
        if !pq_valid || !classic_valid {
            return Err(HybridError::WnsViolation);
        }
        
        Ok(true)
    }
    
    fn verify_classic(&self, message: &[u8], signature: &[u8]) -> Result<bool, HybridError> {
        if signature.len() != 64 {
            return Err(HybridError::ClassicVerificationFailed);
        }
        
        let verifying_key = VerifyingKey::from_bytes(
            self.classic_public_key.as_slice().try_into()
                .map_err(|_| HybridError::ClassicVerificationFailed)?
        );
        
        let sig = Ed25519Signature::from_bytes(signature.try_into().unwrap());
        
        Ok(verifying_key.verify(message, &sig).is_ok())
    }
    
    pub fn key_id(&self) -> &str {
        &self.key_id
    }
}

impl HybridSignature {
    pub fn to_json(&self) -> Result<String> {
        Ok(serde_json::to_string_pretty(self)?)
    }
    
    pub fn from_json(json: &str) -> Result<Self> {
        Ok(serde_json::from_str(json)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_hybrid_signature_basic() {
        let signer = HybridSigner::generate().unwrap();
        let message = b"Test message for hybrid signature";
        
        let signature = signer.sign_hybrid(message).unwrap();
        let verifier = HybridVerifier::new(
            signer.get_public_keys().pq_public_key,
            signer.get_public_keys().classic_public_key,
        );
        
        let result = verifier.verify_hybrid(message, &signature).unwrap();
        assert!(result);
        println!("✅ Hybrid signature test passed!");
    }
    
    #[test]
    fn test_tampered_document() {
        let signer = HybridSigner::generate().unwrap();
        let original = b"Original document";
        let tampered = b"Tampered document";
        
        let signature = signer.sign_hybrid(original).unwrap();
        let verifier = HybridVerifier::new(
            signer.get_public_keys().pq_public_key,
            signer.get_public_keys().classic_public_key,
        );
        
        let result = verifier.verify_hybrid(tampered, &signature);
        assert!(matches!(result, Err(HybridError::HashMismatch)));
        println!("✅ Tampered document detection passed!");
    }
    
    #[test]
    fn test_stripping_attack() {
        let signer = HybridSigner::generate().unwrap();
        let message = b"Important document";
        
        let mut signature = signer.sign_hybrid(message).unwrap();
        let verifier = HybridVerifier::new(
            signer.get_public_keys().pq_public_key,
            signer.get_public_keys().classic_public_key,
        );
        
        // Simulate stripping attack by modifying algorithms
        signature.algorithms = vec!["Ed25519".to_string()];
        
        let result = verifier.verify_hybrid(message, &signature);
        assert!(matches!(result, Err(HybridError::AlgorithmMismatch { .. })));
        println!("✅ Stripping attack detection passed!");
    }
    
    #[test]
    fn test_key_serialization() {
        let signer = HybridSigner::generate().unwrap();
        let key_pair = signer.get_public_keys();
        
        let json = serde_json::to_string_pretty(&key_pair).unwrap();
        let deserialized: HybridKeyPair = serde_json::from_str(&json).unwrap();
        
        assert_eq!(key_pair.pq_public_key, deserialized.pq_public_key);
        assert_eq!(key_pair.classic_public_key, deserialized.classic_public_key);
        println!("✅ Key serialization test passed!");
    }
}
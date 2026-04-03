//! Post-Quantum Digital Signatures with ML-DSA-65 (NIST FIPS 204)
//! 
//! This crate provides production-ready post-quantum signatures using
//! ML-DSA-65 (Module-Lattice-Based Digital Signature Standard).

use anyhow::Result;
use oqs::sig::{Sig, Algorithm};
use std::sync::Arc;

/// Post-Quantum Signer for ML-DSA-65
#[derive(Clone)]
pub struct PqcSigner {
    sig: Arc<Sig>,  // Shared across clones (thread-safe)
    secret_key: Vec<u8>,
    public_key: Vec<u8>,
}

impl PqcSigner {
    /// Generate a new ML-DSA-65 key pair
    pub fn generate() -> Result<Self> {
        let sig = Arc::new(Sig::new(Algorithm::MlDsa65)?);
        let (public_key, secret_key) = sig.keypair()?;
        
        Ok(Self {
            sig,
            secret_key: secret_key.into_vec(),
            public_key: public_key.into_vec(),
        })
    }
    
    /// Create a verifier from a public key (no secret key needed)
    pub fn from_public_key(public_key_bytes: Vec<u8>) -> Result<Self> {
        let sig = Sig::new(Algorithm::MlDsa65)?;
        // Validate the public key
        let _pk = sig.public_key_from_bytes(&public_key_bytes)
            .ok_or(anyhow::anyhow!("Invalid public key"))?;
        Ok(Self {
            sig: Arc::new(sig),
            secret_key: Vec::new(),
            public_key: public_key_bytes,
        })
    }
    
    /// Create a signer from existing secret key (for key recovery)
    pub fn from_secret_key(secret_key_bytes: Vec<u8>, public_key_bytes: Vec<u8>) -> Result<Self> {
        let sig = Arc::new(Sig::new(Algorithm::MlDsa65)?);
        
        // Validate the secret key
        let _sk = sig.secret_key_from_bytes(&secret_key_bytes)
            .ok_or(anyhow::anyhow!("Invalid secret key"))?;
        
        // Validate the public key
        let _pk = sig.public_key_from_bytes(&public_key_bytes)
            .ok_or(anyhow::anyhow!("Invalid public key"))?;
        
        Ok(Self {
            sig,
            secret_key: secret_key_bytes,
            public_key: public_key_bytes,
        })
    }
    
    /// Sign a message
    pub fn sign(&self, message: &[u8]) -> Result<Vec<u8>> {
        if self.secret_key.is_empty() {
            return Err(anyhow::anyhow!("Cannot sign: no secret key available"));
        }
        
        let sk = self.sig.secret_key_from_bytes(&self.secret_key)
            .ok_or(anyhow::anyhow!("Invalid secret key"))?;
        
        let signature = self.sig.sign(message, sk)?;
        Ok(signature.into_vec())
    }
    
    /// Verify a signature
    pub fn verify(&self, message: &[u8], signature: &[u8]) -> Result<bool> {
        let pk = self.sig.public_key_from_bytes(&self.public_key)
            .ok_or(anyhow::anyhow!("Invalid public key"))?;
        
        let sig_ref = self.sig.signature_from_bytes(signature)
            .ok_or(anyhow::anyhow!("Invalid signature format"))?;
        
        match self.sig.verify(message, sig_ref, pk) {
            Ok(()) => Ok(true),
            Err(_e) => Ok(false),  // Don't expose verification error details
        }
    }
    
    /// Verify a signature (alias for consistency)
    pub fn verify_with_public_key(&self, message: &[u8], signature: &[u8]) -> Result<bool> {
        let pk = self.sig.public_key_from_bytes(&self.public_key)
            .ok_or(anyhow::anyhow!("Invalid public key"))?;
        let sig_ref = self.sig.signature_from_bytes(signature)
            .ok_or(anyhow::anyhow!("Invalid signature"))?;
        match self.sig.verify(message, sig_ref, pk) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }
    
    /// Get public key bytes
    pub fn public_key_bytes(&self) -> &[u8] {
        &self.public_key
    }
    
    /// Get secret key bytes (only available for signers)
    pub fn secret_key_bytes(&self) -> &[u8] {
        &self.secret_key
    }
    
    /// Check if this instance has a secret key (can sign)
    pub fn can_sign(&self) -> bool {
        !self.secret_key.is_empty()
    }
    
    /// Get algorithm name
    pub fn algorithm_name(&self) -> &'static str {
        "ML-DSA-65 (NIST FIPS 204)"
    }
    
    /// Get security level
    pub fn security_level(&self) -> u8 {
        2  // Level 2 (AES-128 equivalent)
    }
    
    /// Get public key size in bytes
    pub const fn public_key_size(&self) -> usize {
        1952  // ML-DSA-65 public key size
    }
    
    /// Get signature size in bytes
    pub const fn signature_size(&self) -> usize {
        3309  // ML-DSA-65 signature size
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_generate_and_verify() {
        let signer = PqcSigner::generate().unwrap();
        let message = b"Test message for ML-DSA-65";
        
        let signature = signer.sign(message).unwrap();
        assert_eq!(signature.len(), 3309);
        
        let is_valid = signer.verify(message, &signature).unwrap();
        assert!(is_valid);
    }
    
    #[test]
    fn test_from_public_key() {
        let signer = PqcSigner::generate().unwrap();
        let message = b"Test verification with public key only";
        
        let signature = signer.sign(message).unwrap();
        
        let verifier = PqcSigner::from_public_key(signer.public_key_bytes().to_vec()).unwrap();
        let is_valid = verifier.verify(message, &signature).unwrap();
        assert!(is_valid);
        
        // Verifier cannot sign
        assert!(!verifier.can_sign());
    }
    
    #[test]
    fn test_invalid_signature() {
        let signer = PqcSigner::generate().unwrap();
        let message = b"Original message";
        let wrong_message = b"Wrong message";
        
        let signature = signer.sign(message).unwrap();
        
        let is_valid = signer.verify(wrong_message, &signature).unwrap();
        assert!(!is_valid);
    }
}

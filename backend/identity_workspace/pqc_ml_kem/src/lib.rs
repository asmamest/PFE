//! ML-KEM-768 (Kyber) - Post-Quantum Key Encapsulation Mechanism
//! With AES-256-GCM authenticated encryption
//! 
//! Conforms to NIST FIPS 203 standard

use oqs::kem::{Kem, Algorithm};
use anyhow::Result;
use serde::{Serialize, Deserialize};
use thiserror::Error;
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit};
use rand::rngs::OsRng;
use rand::RngCore;
// ============================================================================
// Error Types
// ============================================================================

#[derive(Error, Debug, Clone, PartialEq)]
pub enum KemError {
    #[error("Invalid public key")]
    InvalidPublicKey,
    #[error("Invalid secret key")]
    InvalidSecretKey,
    #[error("Invalid ciphertext")]
    InvalidCiphertext,
    #[error("Decapsulation failed: {0}")]
    DecapsulationFailed(String),
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),
    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),
    #[error("Invalid shared secret length: expected 32 bytes, got {0}")]
    InvalidSharedSecretLength(usize),
    #[error("Invalid nonce length: expected 12 bytes, got {0}")]
    InvalidNonceLength(usize),
}

pub type KemResult<T> = std::result::Result<T, KemError>;

// ============================================================================
// Types
// ============================================================================

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KeyPair {
    pub public_key: Vec<u8>,
    pub secret_key: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Ciphertext {
    pub data: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EncapsulationResult {
    pub shared_secret: Vec<u8>,
    pub ciphertext: Ciphertext,
}

/// Encrypted message using KEM + AES-256-GCM
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct EncryptedMessage {
    /// KEM ciphertext (1088 bytes) - used to recover the shared secret
    pub kem_ciphertext: Vec<u8>,
    /// AES-GCM encrypted data (ciphertext + authentication tag)
    pub encrypted_data: Vec<u8>,
    /// Nonce for AES-GCM (12 bytes)
    pub nonce: Vec<u8>,
}

// ============================================================================
// ML-KEM-768 Core
// ============================================================================

pub struct MlKem768;

impl MlKem768 {
    // Key size constants
    pub const PUBLIC_KEY_SIZE: usize = 1184;
    pub const SECRET_KEY_SIZE: usize = 2400;
    pub const CIPHERTEXT_SIZE: usize = 1088;
    pub const SHARED_SECRET_SIZE: usize = 32;
    pub const NONCE_SIZE: usize = 12;

    // ========================================================================
    // Core KEM Operations
    // ========================================================================

    /// Generate a new key pair (public + secret)
    pub fn generate() -> Result<KeyPair> {
        let kem = Kem::new(Algorithm::MlKem768)?;
        let (public_key, secret_key) = kem.keypair()?;
        
        Ok(KeyPair {
            public_key: public_key.into_vec(),
            secret_key: secret_key.into_vec(),
        })
    }
    
    /// Encapsulate: create a shared secret and ciphertext from a public key
    pub fn encapsulate(public_key_bytes: &[u8]) -> KemResult<EncapsulationResult> {
        let kem = Kem::new(Algorithm::MlKem768)
            .map_err(|e| KemError::DecapsulationFailed(e.to_string()))?;
        
        let pk = kem.public_key_from_bytes(public_key_bytes)
            .ok_or(KemError::InvalidPublicKey)?;
        
        let (ciphertext, shared_secret) = kem.encapsulate(pk)
            .map_err(|e| KemError::DecapsulationFailed(e.to_string()))?;
        
        Ok(EncapsulationResult {
            shared_secret: shared_secret.into_vec(),
            ciphertext: Ciphertext {
                data: ciphertext.into_vec(),
            },
        })
    }
    
    /// Decapsulate: recover the shared secret from ciphertext using secret key
    pub fn decapsulate(secret_key_bytes: &[u8], ciphertext_bytes: &[u8]) -> KemResult<Vec<u8>> {
        let kem = Kem::new(Algorithm::MlKem768)
            .map_err(|e| KemError::DecapsulationFailed(e.to_string()))?;
        
        let sk = kem.secret_key_from_bytes(secret_key_bytes)
            .ok_or(KemError::InvalidSecretKey)?;
        
        let ct = kem.ciphertext_from_bytes(ciphertext_bytes)
            .ok_or(KemError::InvalidCiphertext)?;
        
        let shared_secret = kem.decapsulate(sk, ct)
            .map_err(|e| KemError::DecapsulationFailed(e.to_string()))?;
        
        Ok(shared_secret.into_vec())
    }

    // ========================================================================
    // AES-256-GCM Encryption/Decryption with Shared Secret
    // ========================================================================

    /// Encrypt a message using the shared secret (authenticated encryption)
    /// 
    /// # Arguments
    /// * `shared_secret` - 32-byte shared secret from KEM
    /// * `plaintext` - Message to encrypt
    /// 
    /// # Returns
    /// * `EncryptedMessage` containing the encrypted data and nonce
    pub fn encrypt_message(shared_secret: &[u8], plaintext: &[u8]) -> KemResult<EncryptedMessage> {
        if shared_secret.len() != Self::SHARED_SECRET_SIZE {
            return Err(KemError::InvalidSharedSecretLength(shared_secret.len()));
        }
        
        // Generate random nonce (12 bytes as recommended for AES-GCM)
        let mut nonce_bytes = [0u8; Self::NONCE_SIZE];
        OsRng.fill_bytes(&mut nonce_bytes);
        
        // Create AES-256-GCM cipher
        let key = Key::<Aes256Gcm>::from_slice(shared_secret);
        let cipher = Aes256Gcm::new(key);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // Encrypt (this includes authentication tag)
        let encrypted_data = cipher.encrypt(nonce, plaintext)
            .map_err(|e| KemError::EncryptionFailed(e.to_string()))?;
        
        Ok(EncryptedMessage {
            kem_ciphertext: vec![],  // Will be filled by encrypt_for_recipient
            encrypted_data,
            nonce: nonce_bytes.to_vec(),
        })
    }
    
    /// Decrypt a message using the shared secret
    /// 
    /// # Arguments
    /// * `shared_secret` - 32-byte shared secret from KEM
    /// * `encrypted` - Encrypted message
    /// 
    /// # Returns
    /// * Decrypted plaintext
    pub fn decrypt_message(shared_secret: &[u8], encrypted: &EncryptedMessage) -> KemResult<Vec<u8>> {
        if shared_secret.len() != Self::SHARED_SECRET_SIZE {
            return Err(KemError::InvalidSharedSecretLength(shared_secret.len()));
        }
        
        if encrypted.nonce.len() != Self::NONCE_SIZE {
            return Err(KemError::InvalidNonceLength(encrypted.nonce.len()));
        }
        
        let key = Key::<Aes256Gcm>::from_slice(shared_secret);
        let cipher = Aes256Gcm::new(key);
        let nonce = Nonce::from_slice(&encrypted.nonce);
        
        let plaintext = cipher.decrypt(nonce, encrypted.encrypted_data.as_ref())
            .map_err(|e| KemError::DecryptionFailed(e.to_string()))?;
        
        Ok(plaintext)
    }

    // ========================================================================
    // Complete Secure Exchange (KEM + Encryption)
    // ========================================================================

    /// Complete secure exchange: Encrypt a message for a recipient's public key
    /// 
    /// This combines KEM encapsulation and AES-GCM encryption in one step.
    /// 
    /// # Arguments
    /// * `recipient_public_key` - Recipient's public key (1184 bytes)
    /// * `plaintext` - Message to encrypt
    /// 
    /// # Returns
    /// * `EncryptedMessage` containing KEM ciphertext + encrypted data + nonce
    pub fn encrypt_for_recipient(recipient_public_key: &[u8], plaintext: &[u8]) -> KemResult<EncryptedMessage> {
        // Step 1: KEM encapsulation to get shared secret and ciphertext
        let encapsulation = Self::encapsulate(recipient_public_key)?;
        
        // Step 2: Encrypt the message with the shared secret
        let mut encrypted = Self::encrypt_message(&encapsulation.shared_secret, plaintext)?;
        
        // Step 3: Store the KEM ciphertext with the encrypted message
        encrypted.kem_ciphertext = encapsulation.ciphertext.data;
        
        Ok(encrypted)
    }
    
    /// Complete secure exchange: Decrypt a message using recipient's secret key
    /// 
    /// This combines KEM decapsulation and AES-GCM decryption in one step.
    /// 
    /// # Arguments
    /// * `recipient_secret_key` - Recipient's secret key (2400 bytes)
    /// * `encrypted` - Encrypted message (contains KEM ciphertext + encrypted data)
    /// 
    /// # Returns
    /// * Decrypted plaintext
    pub fn decrypt_for_recipient(recipient_secret_key: &[u8], encrypted: &EncryptedMessage) -> KemResult<Vec<u8>> {
        // Step 1: KEM decapsulation to recover shared secret
        let shared_secret = Self::decapsulate(recipient_secret_key, &encrypted.kem_ciphertext)?;
        
        // Step 2: Decrypt the message with the shared secret
        Self::decrypt_message(&shared_secret, encrypted)
    }
}

// ============================================================================
// Serialization Helpers
// ============================================================================

impl EncryptedMessage {
    /// Serialize to JSON for storage or transmission
    pub fn to_json(&self) -> Result<String> {
        Ok(serde_json::to_string(self)?)
    }
    
    /// Deserialize from JSON
    pub fn from_json(json: &str) -> Result<Self> {
        Ok(serde_json::from_str(json)?)
    }
    
    /// Get total size in bytes
    pub fn total_size(&self) -> usize {
        self.kem_ciphertext.len() + self.encrypted_data.len() + self.nonce.len()
    }
}

impl KeyPair {
    /// Serialize to JSON for storage
    pub fn to_json(&self) -> Result<String> {
        Ok(serde_json::to_string_pretty(self)?)
    }
    
    /// Deserialize from JSON
    pub fn from_json(json: &str) -> Result<Self> {
        Ok(serde_json::from_str(json)?)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_kem_workflow() {
        println!("\n=== Testing ML-KEM-768 (Kyber) ===\n");
        
        let alice_keys = MlKem768::generate().unwrap();
        println!("✅ Key pair generated");
        println!("   Public key size: {} bytes", alice_keys.public_key.len());
        println!("   Secret key size: {} bytes", alice_keys.secret_key.len());
        
        let encapsulation = MlKem768::encapsulate(&alice_keys.public_key).unwrap();
        println!("\n✅ Encapsulation done (Bob)");
        println!("   Ciphertext size: {} bytes", encapsulation.ciphertext.data.len());
        println!("   Shared secret (Bob): {} bytes", encapsulation.shared_secret.len());
        
        let shared_secret = MlKem768::decapsulate(&alice_keys.secret_key, &encapsulation.ciphertext.data).unwrap();
        println!("\n✅ Decapsulation done (Alice)");
        println!("   Shared secret (Alice): {} bytes", shared_secret.len());
        
        assert_eq!(encapsulation.shared_secret, shared_secret);
        println!("\n🎉 Shared secrets match! KEM workflow successful!");
    }
    
    #[test]
    fn test_encrypted_message_workflow() {
        println!("\n=== Testing Encrypted Message Workflow ===\n");
        
        // Alice generates her key pair
        let alice_keys = MlKem768::generate().unwrap();
        println!("✅ Alice's key pair generated");
        
        // Bob encrypts a message for Alice
        let message = b"Secret diploma: Master in Post-Quantum Cryptography";
        println!("📝 Original message: {:?}", String::from_utf8_lossy(message));
        
        let encrypted = MlKem768::encrypt_for_recipient(&alice_keys.public_key, message).unwrap();
        println!("\n✅ Bob encrypted the message");
        println!("   KEM ciphertext size: {} bytes", encrypted.kem_ciphertext.len());
        println!("   Encrypted data size: {} bytes", encrypted.encrypted_data.len());
        println!("   Nonce size: {} bytes", encrypted.nonce.len());
        println!("   Total size: {} bytes", encrypted.total_size());
        
        // Alice decrypts the message
        let decrypted = MlKem768::decrypt_for_recipient(&alice_keys.secret_key, &encrypted).unwrap();
        println!("\n✅ Alice decrypted the message");
        println!("📝 Decrypted message: {:?}", String::from_utf8_lossy(&decrypted));
        
        assert_eq!(message.to_vec(), decrypted);
        println!("\n🎉 Encrypted message workflow successful!");
    }
    
    #[test]
    fn test_wrong_key_returns_different_secret() {
        println!("\n=== Testing Wrong Key Returns Different Secret ===\n");
        
        let alice_keys = MlKem768::generate().unwrap();
        let bob_keys = MlKem768::generate().unwrap();
        
        let encapsulation = MlKem768::encapsulate(&alice_keys.public_key).unwrap();
        println!("✅ Encapsulation with Alice's public key");
        
        let alice_secret = MlKem768::decapsulate(&alice_keys.secret_key, &encapsulation.ciphertext.data).unwrap();
        println!("✅ Alice decapsulated correctly");
        
        let bob_secret = MlKem768::decapsulate(&bob_keys.secret_key, &encapsulation.ciphertext.data).unwrap();
        println!("✅ Bob also decapsulated (but with wrong key)");
        
        assert_ne!(alice_secret, bob_secret);
        println!("\n🎉 Wrong key produces a DIFFERENT shared secret!");
    }
    
    #[test]
    fn test_json_serialization() {
        println!("\n=== Testing JSON Serialization ===\n");
        
        let alice_keys = MlKem768::generate().unwrap();
        let message = b"Test message for JSON serialization";
        
        let encrypted = MlKem768::encrypt_for_recipient(&alice_keys.public_key, message).unwrap();
        let json = encrypted.to_json().unwrap();
        let deserialized = EncryptedMessage::from_json(&json).unwrap();
        
        assert_eq!(encrypted.kem_ciphertext, deserialized.kem_ciphertext);
        assert_eq!(encrypted.encrypted_data, deserialized.encrypted_data);
        assert_eq!(encrypted.nonce, deserialized.nonce);
        
        println!("✅ JSON serialization successful!");
        println!("   JSON size: {} bytes", json.len());
        
        let key_json = alice_keys.to_json().unwrap();
        let deserialized_keys = KeyPair::from_json(&key_json).unwrap();
        assert_eq!(alice_keys.public_key, deserialized_keys.public_key);
        assert_eq!(alice_keys.secret_key, deserialized_keys.secret_key);
        
        println!("✅ Key JSON serialization successful!");
    }
    
    #[test]
    fn test_key_sizes() {
        let keys = MlKem768::generate().unwrap();
        
        assert_eq!(keys.public_key.len(), MlKem768::PUBLIC_KEY_SIZE);
        assert_eq!(keys.secret_key.len(), MlKem768::SECRET_KEY_SIZE);
        
        let encapsulation = MlKem768::encapsulate(&keys.public_key).unwrap();
        assert_eq!(encapsulation.ciphertext.data.len(), MlKem768::CIPHERTEXT_SIZE);
        assert_eq!(encapsulation.shared_secret.len(), MlKem768::SHARED_SECRET_SIZE);
        
        println!("\n=== Key Sizes Validation ===");
        println!("✅ Public key: {} bytes", MlKem768::PUBLIC_KEY_SIZE);
        println!("✅ Secret key: {} bytes", MlKem768::SECRET_KEY_SIZE);
        println!("✅ Ciphertext: {} bytes", MlKem768::CIPHERTEXT_SIZE);
        println!("✅ Shared secret: {} bytes", MlKem768::SHARED_SECRET_SIZE);
    }
    
    #[test]
    fn test_large_message() {
        println!("\n=== Testing Large Message Encryption ===\n");
        
        let alice_keys = MlKem768::generate().unwrap();
        
        // Create a large message (10 KB)
        let large_message = vec![b'A'; 10 * 1024];
        println!("📝 Large message size: {} bytes", large_message.len());
        
        let encrypted = MlKem768::encrypt_for_recipient(&alice_keys.public_key, &large_message).unwrap();
        println!("✅ Encrypted large message");
        
        let decrypted = MlKem768::decrypt_for_recipient(&alice_keys.secret_key, &encrypted).unwrap();
        println!("✅ Decrypted large message");
        
        assert_eq!(large_message, decrypted);
        println!("\n🎉 Large message encryption successful!");
        println!("   Overhead: {} bytes", encrypted.total_size() - large_message.len());
    }
}

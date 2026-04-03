use hybrid_signer::{HybridSigner, HybridVerifier, CompositeSignature};

#[test]
fn test_full_workflow() {
    println!("\n=== Test Full Workflow ===");
    
    let signer = HybridSigner::generate().unwrap();
    let jwk = signer.export_composite_jwk();
    let message = b"Production test message - sign me!";
    
    let signature = signer.sign_composite(message).unwrap();
    let verifier = HybridVerifier::from_composite_jwk(&jwk).unwrap();
    let result = verifier.verify_composite(message, &signature).unwrap();
    
    assert!(result);
    println!("✅ Full workflow OK");
    println!("   Signature size: {} bytes", signature.pq_signature.len() + signature.classical_signature.len());
}

#[test]
fn test_tampered_message() {
    println!("\n=== Test Tampered Message ===");
    
    let signer = HybridSigner::generate().unwrap();
    let jwk = signer.export_composite_jwk();
    let original = b"Original important document";
    let tampered = b"Tampered document";
    
    let signature = signer.sign_composite(original).unwrap();
    let verifier = HybridVerifier::from_composite_jwk(&jwk).unwrap();
    let result = verifier.verify_composite(tampered, &signature);
    
    assert!(result.is_err());
    println!("✅ Tampered message correctly rejected");
}

#[test]
fn test_binding_hash_tampering() {
    println!("\n=== Test Binding Hash Tampering ===");
    
    let signer = HybridSigner::generate().unwrap();
    let jwk = signer.export_composite_jwk();
    let message = b"Message with strong binding";
    
    let mut signature = signer.sign_composite(message).unwrap();
    signature.binding_hash[0] ^= 0xFF; // Tamper the binding hash
    
    let verifier = HybridVerifier::from_composite_jwk(&jwk).unwrap();
    let result = verifier.verify_composite(message, &signature);
    
    assert!(matches!(result, Err(hybrid_signer::HybridError::WnsViolation)));
    println!("✅ Binding hash tampering detected");
}

#[test]
fn test_expired_signature() {
    println!("\n=== Test Expired Signature ===");
    
    let signer = HybridSigner::generate().unwrap();
    let jwk = signer.export_composite_jwk();
    let message = b"Old document";
    
    let mut signature = signer.sign_composite(message).unwrap();
    signature.timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() - 600; // 10 minutes ago
    
    let verifier = HybridVerifier::from_composite_jwk(&jwk).unwrap();
    let result = verifier.verify_composite(message, &signature);
    
    assert!(matches!(result, Err(hybrid_signer::HybridError::TimestampValidationFailed)));
    println!("✅ Expired signature rejected");
}

#[test]
fn test_serialization_roundtrip() {
    println!("\n=== Test Serialization Roundtrip ===");
    
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
    println!("   JSON size: {} bytes", json.len());
}

#[test]
fn test_key_pair_serialization() {
    println!("\n=== Test Key Pair Serialization ===");
    
    let signer = HybridSigner::generate().unwrap();
    let key_pair = signer.get_key_pair();
    
    let json = serde_json::to_string_pretty(&key_pair).unwrap();
    let deserialized: hybrid_signer::HybridKeyPair = serde_json::from_str(&json).unwrap();
    
    assert_eq!(key_pair.pq_public_key, deserialized.pq_public_key);
    assert_eq!(key_pair.classical_public_key, deserialized.classical_public_key);
    
    println!("✅ Key pair serialization OK");
    println!("   PQ public key size: {} bytes", key_pair.pq_public_key.len());
    println!("   Classical public key size: {} bytes", key_pair.classical_public_key.len());
}

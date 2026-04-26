// identity_storage/examples/store_credential.rs
use identity_storage::{StorageClient, CredentialData, Metadata, AiResult};
use serde_json::json;
use pqc_ml_dsa::PqcSigner;  // Ta bibliothèque ML-DSA
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔐 QSDID - Store Credential on IPFS");
    println!("===================================\n");
    
    // 1. Générer ou charger la clé ML-DSA
    println!("📋 Step 1: Loading ML-DSA-65 key pair...");
    let signer = PqcSigner::generate()?;
    println!("   ✅ Public key size: {} bytes", signer.public_key_bytes().len());
    println!("   🔐 Secret key size: {} bytes\n", signer.secret_key_bytes().len());
    
    // 2. Créer le credential
    println!("📝 Step 2: Creating credential...");
    let credential = CredentialData {
        claims: json!({
            "name": "Mariem Belhaj",
            "residencePermitNumber": "TUN-2024-123456",
            "nationality": "Tunisian",
            "residenceType": "Student"
        }),
        metadata: Metadata {
            credential_type: "ResidentCard".to_string(),
            issuer_did: "did:qsdid:gov:tunisia".to_string(),
            holder_did: "did:qsdid:holder:mariem".to_string(),
            uuid: Uuid::new_v4().to_string(),
            issued_at: chrono::Utc::now().to_rfc3339(),
            expires_at: Some("2025-12-31T00:00:00Z".to_string()),
        },
        ai_result: AiResult {
            fraud_score: 0.02,
            heatmap_hash: "sha256:abc123def456...".to_string(),
            analysis_timestamp: chrono::Utc::now().to_rfc3339(),
        },
        image: None,
    };
    println!("   ✅ Credential created (UUID: {})\n", credential.metadata.uuid);
    
    // 3. Signer le credential avec ML-DSA-65
    println!("✍️  Step 3: Signing credential with ML-DSA-65...");
    let credential_bytes = serde_json::to_vec(&credential)?;
    let signature = signer.sign(&credential_bytes)?;
    println!("   ✅ Signature size: {} bytes\n", signature.len());
    
    // 4. Stocker sur IPFS via le storage module
    println!("💾 Step 4: Storing on IPFS...");
    let client = StorageClient::new("http://localhost:3500");
    
    // Vérifier que le storage module est accessible
    match client.health_check().await {
        Ok(true) => println!("   ✅ Storage module is healthy"),
        Ok(false) => println!("   ⚠️  Storage module is not healthy"),
        Err(e) => {
            println!("   ❌ Cannot connect to storage module: {}", e);
            println!("   💡 Make sure to run: docker compose up -d");
            return Ok(());
        }
    }
    
    // Stocker
    match client.store_credential(&credential, signature).await {
        Ok(response) => {
            println!("\n🎉 SUCCESS!");
            println!("   Credential ID: {}", response.credential_id);
            println!("   Root CID: {}", response.root_cid);
            println!("\n📌 This CID should now be stored on the blockchain!");
        }
        Err(e) => {
            println!("\n❌ Failed to store: {}", e);
        }
    }
    
    Ok(())
}
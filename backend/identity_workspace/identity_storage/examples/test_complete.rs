use identity_storage::{StorageClient, CredentialData, Metadata, AiResult};
use serde_json::json;
use base64::{engine::general_purpose::STANDARD, Engine};
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔐 QSDID - Test du storage module");
    println!("================================\n");
    
    // 1. Créer un credential de test
    let credential = CredentialData {
        claims: json!({
            "name": "Mariem Belhaj",
            "residencePermitNumber": "TUN-2024-123456",
            "nationality": "Tunisian"
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
            heatmap_hash: "sha256:abc123def456".to_string(),
            analysis_timestamp: chrono::Utc::now().to_rfc3339(),
        },
        image: None,
    };
    
    // 2. Signature simulée (à remplacer par vraie signature ML-DSA plus tard)
    let fake_signature = vec![0u8; 64];
    let signature_base64 = STANDARD.encode(&fake_signature);
    println!("✅ Credential préparé (UUID: {})", credential.metadata.uuid);
    println!("   Signature (simulée): {} bytes\n", fake_signature.len());
    
    // 3. Connexion au storage module
    let client = StorageClient::new("http://localhost:3500");
    
    // Vérifier la santé
    match client.health_check().await {
        Ok(true) => println!("✅ Storage module connecté sur http://localhost:3500"),
        Ok(false) => println!("⚠️ Storage module répond mais pas healthy"),
        Err(e) => {
            println!("❌ Storage module indisponible: {}", e);
            println!("   Assure-toi que docker compose up -d est lancé");
            return Ok(());
        }
    }
    
    // 4. Stocker le credential
    println!("\n📤 Stockage du credential...");
    match client.store_credential(&credential, signature_base64).await {
        Ok(response) => {
            println!("✅ Credential stocké avec succès !");
            println!("   Credential ID: {}", response.credential_id);
            println!("   Root CID: {}", response.root_cid);
            
            // 5. Récupérer le credential
            println!("\n📥 Récupération du credential...");
            let issuer_pub_key_hex = "test_pub_key_for_demo";
            match client.retrieve_credential(&response.root_cid, issuer_pub_key_hex).await {
                Ok(retrieved) => {
                    println!("✅ Credential récupéré !");
                    println!("   Signature valide: {}", retrieved.signature_valid);
                    println!("   Claims: {}", retrieved.claims);
                    println!("   Metadata: {}", retrieved.metadata);
                }
                Err(e) => println!("❌ Erreur récupération: {}", e),
            }
        }
        Err(e) => println!("❌ Erreur stockage: {}", e),
    }
    
    Ok(())
}

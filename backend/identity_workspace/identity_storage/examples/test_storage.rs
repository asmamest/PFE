use identity_storage::StorageClient;
use serde_json::json;

#[tokio::main]
async fn main() {
    println!("🔌 Testing storage module integration...");
    
    let client = StorageClient::new("http://localhost:3500");
    
    // Vérifier la santé
    match client.health_check().await {
        Ok(true) => println!("✅ Storage module is healthy!"),
        Ok(false) => println!("⚠️ Storage module is not healthy"),
        Err(e) => println!("❌ Cannot connect: {}", e),
    }
    
    // Préparer un credential
    let claims = json!({
        "name": "Alice Dupont",
        "email": "alice@example.com",
        "age": 30
    });
    
    let metadata = json!({
        "type": "Passport",
        "issuer": "did:qsdid:issuer:gov",
        "holder": "did:qsdid:holder:alice",
        "credentialId": "123e4567-e89b-12d3-a456-426614174000"
    });
    
    // Signature ML-DSA (temporaire - à remplacer par vraie signature)
    let signature = vec![0u8; 3300];  // ML-DSA-65 fait ~3300 bytes
    
    println!("\n📤 Storing credential...");
    match client.store_credential(claims, metadata, signature, None).await {
        Ok(response) => {
            println!("✅ Credential stored successfully!");
            println!("   Credential ID: {}", response.credential_id);
            println!("   Root CID: {}", response.root_cid);
            
            // Récupérer le credential
            println!("\n📥 Retrieving credential...");
            // Note: Remplacer par la vraie clé publique hex
            let issuer_pub_key = "deadbeef".repeat(64); // Exemple
            
            match client.retrieve_credential(&response.rootCid, &issuer_pub_key).await {
                Ok(retrieved) => {
                    println!("✅ Credential retrieved!");
                    println!("   Signature valid: {}", retrieved.signatureValid);
                    println!("   Claims: {}", retrieved.claims);
                }
                Err(e) => println!("❌ Retrieve failed: {}", e),
            }
        }
        Err(e) => println!("❌ Store failed: {}", e),
    }
}
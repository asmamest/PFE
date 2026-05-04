use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;
use reqwest::Client;
use serde_json::json;
use std::cell::RefCell;
use hex;
use base64::Engine;
use uuid::Uuid;
use hybrid_signer::{HybridSigner, CompositeSignature};
use base64::engine::general_purpose::STANDARD as BASE64;

// Configuration globale de l'API
thread_local! {
    static API_BASE_URL: RefCell<String> = RefCell::new("http://localhost:8083".to_string());
    static HTTP_CLIENT: RefCell<Client> = RefCell::new(Client::new());
}

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

/// Définir l'URL de base de l'API
#[wasm_bindgen]
pub fn set_api_base_url(url: &str) {
    API_BASE_URL.with(|base| {
        *base.borrow_mut() = url.to_string();
    });
}

#[wasm_bindgen]
pub fn sign_with_private_key_hex(
    document_b64: &str,
    pq_secret_hex: &str,
    classical_secret_hex: &str,
) -> Result<JsValue, JsValue> {
    // 1. Décoder le document
    let doc_bytes = base64::engine::general_purpose::STANDARD
        .decode(document_b64)
        .map_err(|e| JsValue::from_str(&format!("Invalid base64: {}", e)))?;
    
    // 2. Reconstruire le signeur
    let signer = HybridSigner::from_private_keys_hex(pq_secret_hex, classical_secret_hex)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    // 3. Signer
    let signature = signer.sign_composite(&doc_bytes)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    // 4. Sérialiser la signature en JSON
    let sig_json = signature.to_json()
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    
    // 5. Générer un ID (optionnel)
    let signature_id = format!("sig_{}", uuid::Uuid::new_v4().simple());
    
    let result = json!({
        "signature_id": signature_id,
        "signature_json": sig_json,
        "document_hash": hex::encode(&signature.document_hash),
        "signature_size": signature.pq_signature.len() + signature.classical_signature.len(),
        "algorithms": vec!["ML-DSA-65", "Ed25519"],
        "timestamp": signature.timestamp,
    });
    
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

fn get_api_base_url() -> String {
    API_BASE_URL.with(|base| base.borrow().clone())
}

async fn api_post(endpoint: &str, body: JsValue) -> Result<JsValue, JsValue> {
    let url = format!("{}/{}", get_api_base_url(), endpoint);
    let client = Client::new();
    
    let body_string = js_sys::JSON::stringify(&body)
        .map_err(|e| JsValue::from_str(&e.as_string().unwrap_or_default()))?
        .as_string()
        .unwrap_or_default();
    
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .body(body_string)
        .send()
        .await
        .map_err(|e| JsValue::from_str(&format!("Request failed: {}", e)))?;
    
    if !response.status().is_success() {
        return Err(JsValue::from_str(&format!("HTTP error {}", response.status())));
    }
    
    let text = response.text()
        .await
        .map_err(|e| JsValue::from_str(&format!("Response error: {}", e)))?;
    
    let json = js_sys::JSON::parse(&text)
        .map_err(|e| JsValue::from_str(&e.as_string().unwrap_or_default()))?;
    
    Ok(json)
}

async fn api_get(endpoint: &str) -> Result<JsValue, JsValue> {
    let url = format!("{}/{}", get_api_base_url(), endpoint);
    let client = Client::new();
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| JsValue::from_str(&format!("Request failed: {}", e)))?;
    
    if !response.status().is_success() {
        return Err(JsValue::from_str(&format!("HTTP error {}", response.status())));
    }
    
    let text = response.text()
        .await
        .map_err(|e| JsValue::from_str(&format!("Response error: {}", e)))?;
    
    let json = js_sys::JSON::parse(&text)
        .map_err(|e| JsValue::from_str(&e.as_string().unwrap_or_default()))?;
    
    Ok(json)
}

// ============================================================================
// Signatures hybrides
// ============================================================================

#[wasm_bindgen]
pub async fn generate_hybrid_keys() -> Result<JsValue, JsValue> {
    api_post("keys/generate", JsValue::NULL).await
}

#[wasm_bindgen]
pub async fn sign_document(document_b64: &str) -> Result<JsValue, JsValue> {
    let body = json!({ "document": document_b64 });
    let body_js = serde_wasm_bindgen::to_value(&body)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    api_post("sign", body_js).await
}

#[wasm_bindgen]
pub async fn verify_signature(signature_id: &str, document_b64: &str) -> Result<JsValue, JsValue> {
    let body = json!({ "signature_id": signature_id, "document": document_b64 });
    let body_js = serde_wasm_bindgen::to_value(&body)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    api_post("verify", body_js).await
}

#[wasm_bindgen]
pub async fn get_signature(signature_id: &str) -> Result<JsValue, JsValue> {
    api_get(&format!("signatures/{}", signature_id)).await
}

#[wasm_bindgen]
pub async fn list_signatures() -> Result<JsValue, JsValue> {
    api_get("signatures").await
}

#[wasm_bindgen]
pub async fn delete_signature(signature_id: &str) -> Result<JsValue, JsValue> {
    let url = format!("{}/signatures/{}", get_api_base_url(), signature_id);
    let client = Client::new();
    
    let response = client
        .delete(&url)
        .send()
        .await
        .map_err(|e| JsValue::from_str(&format!("Request failed: {}", e)))?;
    
    if !response.status().is_success() {
        return Err(JsValue::from_str(&format!("HTTP error {}", response.status())));
    }
    
    let text = response.text()
        .await
        .map_err(|e| JsValue::from_str(&format!("Response error: {}", e)))?;
    
    let json: JsValue = serde_json::from_str(&text)
        .map_err(|e| JsValue::from_str(&format!("JSON parse error: {}", e)))?;
    
    Ok(json)
}

#[wasm_bindgen]
pub fn generate_hybrid_keys_local() -> Result<JsValue, JsValue> {
    use hybrid_signer::HybridSigner;
    let signer = HybridSigner::generate()
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let key_pair = signer.get_key_pair();
    let result = serde_json::json!({
        "pq_public_key": hex::encode(&key_pair.pq_public_key),
        "pq_secret_key": hex::encode(&key_pair.pq_secret_key),
        "classical_public_key": hex::encode(&key_pair.classical_public_key),
        "classical_secret_key": hex::encode(&key_pair.classical_secret_key),
        "key_id": key_pair.key_id,
    });
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}
// ============================================================================
// KEM (ML-KEM-768)
// ============================================================================

#[wasm_bindgen]
pub async fn generate_kem_keys() -> Result<JsValue, JsValue> {
    api_post("kem/generate", JsValue::NULL).await
}

#[wasm_bindgen]
pub async fn kem_encapsulate(public_key_hex: &str) -> Result<JsValue, JsValue> {
    let body = json!({ "public_key": public_key_hex });
    let body_js = serde_wasm_bindgen::to_value(&body)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    api_post("kem/encapsulate", body_js).await
}

#[wasm_bindgen]
pub async fn kem_decapsulate(secret_key_hex: &str, ciphertext_hex: &str) -> Result<JsValue, JsValue> {
    let body = json!({ "secret_key": secret_key_hex, "ciphertext": ciphertext_hex });
    let body_js = serde_wasm_bindgen::to_value(&body)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    api_post("kem/decapsulate", body_js).await
}

#[wasm_bindgen]
pub async fn kem_encrypt(public_key_hex: &str, plaintext_b64: &str) -> Result<JsValue, JsValue> {
    let body = json!({ "public_key": public_key_hex, "plaintext": plaintext_b64 });
    let body_js = serde_wasm_bindgen::to_value(&body)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    api_post("kem/encrypt", body_js).await
}

#[wasm_bindgen]
pub async fn kem_decrypt(
    secret_key_hex: &str,
    kem_ciphertext_hex: &str,
    encrypted_data_b64: &str,
    nonce_hex: &str,
) -> Result<JsValue, JsValue> {
    let body = json!({
        "secret_key": secret_key_hex,
        "kem_ciphertext": kem_ciphertext_hex,
        "encrypted_data": encrypted_data_b64,
        "nonce": nonce_hex,
    });
    let body_js = serde_wasm_bindgen::to_value(&body)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    api_post("kem/decrypt", body_js).await
}

// ============================================================================
// Utilitaires
// ============================================================================

#[wasm_bindgen]
pub async fn get_stats() -> Result<JsValue, JsValue> {
    api_get("stats").await
}

#[wasm_bindgen]
pub async fn health_check() -> Result<JsValue, JsValue> {
    api_get("health").await
}

#[wasm_bindgen]
pub fn hash_document(document: &[u8]) -> String {
    let hash = blake3::hash(document);
    hex::encode(hash.as_bytes())
}

#[wasm_bindgen]
pub fn to_base64(data: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(data)
}

#[wasm_bindgen]
pub fn from_base64(base64_str: &str) -> Result<String, JsValue> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(base64_str)
        .map_err(|e: base64::DecodeError| JsValue::from_str(&e.to_string()))?;
    Ok(hex::encode(bytes))
}

#[wasm_bindgen]
pub fn generate_id() -> String {
    let timestamp = js_sys::Date::now();
    let random = js_sys::Math::random();
    format!("id_{}_{}", timestamp as u64, (random * 10000.0) as u64)
}

//! QSDID Platform REST API
//! - Hybrid signatures (ML-DSA-65 + Ed25519) with WNS
//! - Post-quantum key exchange (ML-KEM-768) with authenticated encryption

//! QSDID Platform REST API
//! Post-Quantum Hybrid Signatures (ML-DSA-65 + Ed25519) + KEM

use axum::{
    extract::{Path, Query},
    response::{Json, IntoResponse},
    http::StatusCode,
    Router, routing::{get, post, delete},
};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;
use tracing::{info};
use tower_http::cors::{CorsLayer, Any};
use base64::Engine;

use hybrid_signer::{HybridSigner, HybridVerifier, CompositeSignature, CustomCompositeJwk};
use pqc_ml_kem::{MlKem768, EncryptedMessage, KeyPair as KemKeyPair};

// ============================================================================
// Application State
// ============================================================================

#[derive(Clone)]
struct AppState {
    signatures: Arc<Mutex<HashMap<String, SignatureEntry>>>,
    kem_keys: Arc<Mutex<HashMap<String, KemKeyPair>>>,
}

#[derive(Clone)]
struct SignatureEntry {
    signature_id: String,
    document_hash: String,
    signature: CompositeSignature,
    /// Stocker la clé publique composite pour la vérification
    public_key_jwk: CustomCompositeJwk,
    created_at: chrono::DateTime<chrono::Utc>,
    document_name: Option<String>,
}

// ============================================================================
// Request/Response Models
// ============================================================================

#[derive(Debug, Deserialize)]
struct SignRequest {
    document: String,  // Base64 encoded document
    document_name: Option<String>,
}

#[derive(Debug, Serialize)]
struct SignResponse {
    signature_id: String,
    signature_json: String,
    document_hash: String,
    signature_size: usize,
    algorithms: Vec<String>,
    timestamp: i64,
    signing_time_ms: u128,
}

#[derive(Debug, Deserialize)]
struct VerifyRequest {
    signature_id: String,
    document: String,  // Base64 encoded document
}

#[derive(Debug, Serialize)]
struct VerifyResponse {
    valid: bool,
    message: String,
    verification_time_ms: u128,
}

// ============================================================================
// API Handlers
// ============================================================================

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "version": env!("CARGO_PKG_VERSION"),
        "algorithms": ["ML-DSA-65", "Ed25519", "ML-KEM-768"],
        "features": ["Weak Non-Separability (WNS)", "Composite Signatures", "Post-Quantum Encryption"]
    }))
}

async fn generate_keys() -> impl IntoResponse {
    match HybridSigner::generate() {
        Ok(signer) => {
            let key_pair = signer.get_key_pair();
            let composite_jwk = signer.export_composite_jwk();
            let key_id = format!("key_{}", Uuid::new_v4().simple());
            
            (StatusCode::CREATED, Json(serde_json::json!({
                "key_id": key_id,
                "pq_public_key": hex::encode(&key_pair.pq_public_key),
                "classical_public_key": hex::encode(&key_pair.classical_public_key),
                "pq_public_key_size": key_pair.pq_public_key.len(),
                "classical_public_key_size": key_pair.classical_public_key.len(),
                "composite_jwk": composite_jwk,
            })))
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("Key generation failed: {}", e)
        }))),
    }
}

async fn sign_document(
    state: axum::extract::State<AppState>,
    Json(req): Json<SignRequest>,
) -> impl IntoResponse {
    let start = std::time::Instant::now();
    
    let document_bytes = match base64::engine::general_purpose::STANDARD.decode(&req.document) {
        Ok(d) => d,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid base64: {}", e)
        }))),
    };
    
    let signer = match HybridSigner::generate() {
        Ok(s) => s,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("Signer failed: {}", e)
        }))),
    };
    
    // Récupérer la clé publique AVANT de signer
    let public_key_jwk = signer.export_composite_jwk();
    
    let signature = match signer.sign_composite(&document_bytes) {
        Ok(s) => s,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("Signing failed: {}", e)
        }))),
    };
    
    let signature_json = match signature.to_json() {
        Ok(j) => j,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("Serialization failed: {}", e)
        }))),
    };
    
    let signature_id = format!("sig_{}", Uuid::new_v4().simple());
    let document_hash_hex = hex::encode(&signature.document_hash);
    let signature_size = signature.pq_signature.len() + signature.classical_signature.len();
    
    {
        let mut signatures = state.signatures.lock().unwrap();
        signatures.insert(signature_id.clone(), SignatureEntry {
            signature_id: signature_id.clone(),
            document_hash: document_hash_hex.clone(),
            signature,
            public_key_jwk,
            created_at: chrono::Utc::now(),
            document_name: req.document_name,
        });
    }
    
    let elapsed = start.elapsed();
    info!("Signed document '{}' in {:?}", signature_id, elapsed);
    
    (StatusCode::CREATED, Json(serde_json::json!({
        "signature_id": signature_id,
        "signature_json": signature_json,
        "document_hash": document_hash_hex,
        "signature_size": signature_size,
        "algorithms": vec!["ML-DSA-65", "Ed25519"],
        "timestamp": chrono::Utc::now().timestamp(),
        "signing_time_ms": elapsed.as_millis(),
    })))
}

async fn verify_signature(
    state: axum::extract::State<AppState>,
    Json(req): Json<VerifyRequest>,
) -> impl IntoResponse {
    let start = std::time::Instant::now();
    
    let signature_entry = {
        let signatures = state.signatures.lock().unwrap();
        signatures.get(&req.signature_id).cloned()
    };
    
    let signature_entry = match signature_entry {
        Some(s) => s,
        None => return (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": format!("Signature '{}' not found", req.signature_id)
        }))),
    };
    
    let document_bytes = match base64::engine::general_purpose::STANDARD.decode(&req.document) {
        Ok(d) => d,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid base64: {}", e)
        }))),
    };
    
    // CRÉER UN VÉRIFICATEUR AVEC LA CLÉ PUBLIQUE STOCKÉE
    let verifier = match HybridVerifier::from_composite_jwk(&signature_entry.public_key_jwk) {
        Ok(v) => v,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Failed to create verifier: {}", e)
            })));
        }
    };
    
    let is_valid = match verifier.verify_composite(&document_bytes, &signature_entry.signature) {
        Ok(valid) => valid,
        Err(e) => {
            let elapsed = start.elapsed();
            return (StatusCode::OK, Json(serde_json::json!({
                "valid": false,
                "message": format!("Verification failed: {}", e),
                "verification_time_ms": elapsed.as_millis(),
            })));
        }
    };
    
    let elapsed = start.elapsed();
    info!("Verified signature '{}' in {:?}", req.signature_id, elapsed);
    
    (StatusCode::OK, Json(serde_json::json!({
        "valid": is_valid,
        "message": if is_valid { "Signature is VALID" } else { "Signature is INVALID" },
        "verification_time_ms": elapsed.as_millis(),
        "document_hash": signature_entry.document_hash,
    })))
}

async fn get_signature(
    state: axum::extract::State<AppState>,
    Path(signature_id): Path<String>,
) -> impl IntoResponse {
    let signatures = state.signatures.lock().unwrap();
    
    match signatures.get(&signature_id) {
        Some(entry) => {
            let signature_json = entry.signature.to_json().unwrap_or_default();
            (StatusCode::OK, Json(serde_json::json!({
                "signature_id": entry.signature_id,
                "document_hash": entry.document_hash,
                "signature_json": signature_json,
                "created_at": entry.created_at.to_rfc3339(),
                "document_name": entry.document_name,
                "algorithm": entry.signature.algorithm.name(),
                "timestamp": entry.signature.timestamp,
            })))
        }
        None => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": format!("Signature '{}' not found", signature_id)
        }))),
    }
}

async fn delete_signature(
    state: axum::extract::State<AppState>,
    Path(signature_id): Path<String>,
) -> impl IntoResponse {
    let mut signatures = state.signatures.lock().unwrap();
    
    if signatures.remove(&signature_id).is_some() {
        info!("Deleted signature '{}'", signature_id);
        (StatusCode::OK, Json(serde_json::json!({
            "message": format!("Signature '{}' deleted", signature_id)
        })))
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": format!("Signature '{}' not found", signature_id)
        })))
    }
}

async fn list_signatures(state: axum::extract::State<AppState>) -> impl IntoResponse {
    let signatures = state.signatures.lock().unwrap();
    
    let signature_list: Vec<_> = signatures.iter().map(|(id, entry)| {
        serde_json::json!({
            "signature_id": id,
            "document_hash": entry.document_hash,
            "created_at": entry.created_at.to_rfc3339(),
            "document_name": entry.document_name,
            "algorithm": entry.signature.algorithm.name(),
        })
    }).collect();
    
    Json(serde_json::json!({
        "signatures": signature_list,
        "count": signature_list.len()
    }))
}

async fn get_stats(state: axum::extract::State<AppState>) -> Json<serde_json::Value> {
    let signatures = state.signatures.lock().unwrap();
    
    Json(serde_json::json!({
        "total_signatures": signatures.len(),
        "algorithms": {
            "ml_dsa_65": true,
            "ed25519": true,
            "hybrid_wns": true,
            "ml_kem_768": true
        },
        "key_sizes": {
            "pq_public_key": 1952,
            "classical_public_key": 32,
            "signature_total": 3373,
            "kem_public_key": 1184,
            "kem_secret_key": 2400,
            "kem_ciphertext": 1088
        }
    }))
}

// ============================================================================
// KEM Handlers
// ============================================================================

async fn kem_generate() -> impl IntoResponse {
    match MlKem768::generate() {
        Ok(kp) => {
            (StatusCode::CREATED, Json(serde_json::json!({
                "public_key": hex::encode(&kp.public_key),
                "secret_key": hex::encode(&kp.secret_key),
                "public_key_size": kp.public_key.len(),
                "secret_key_size": kp.secret_key.len(),
            })))
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("KEM generation failed: {}", e)
        }))),
    }
}

async fn kem_encapsulate(Json(req): Json<serde_json::Value>) -> impl IntoResponse {
    let pub_key_hex = req.get("public_key").and_then(|v| v.as_str()).unwrap_or("");
    let pub_key = match hex::decode(pub_key_hex) {
        Ok(k) => k,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid hex public key: {}", e)
        }))),
    };
    
    match MlKem768::encapsulate(&pub_key) {
        Ok(res) => {
            (StatusCode::OK, Json(serde_json::json!({
                "shared_secret": hex::encode(&res.shared_secret),
                "ciphertext": hex::encode(&res.ciphertext.data),
            })))
        }
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Encapsulation failed: {}", e)
        }))),
    }
}

async fn kem_decapsulate(Json(req): Json<serde_json::Value>) -> impl IntoResponse {
    let secret_key_hex = req.get("secret_key").and_then(|v| v.as_str()).unwrap_or("");
    let ciphertext_hex = req.get("ciphertext").and_then(|v| v.as_str()).unwrap_or("");
    
    let secret_key = match hex::decode(secret_key_hex) {
        Ok(k) => k,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid hex secret key: {}", e)
        }))),
    };
    
    let ciphertext = match hex::decode(ciphertext_hex) {
        Ok(c) => c,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid hex ciphertext: {}", e)
        }))),
    };
    
    match MlKem768::decapsulate(&secret_key, &ciphertext) {
        Ok(secret) => {
            (StatusCode::OK, Json(serde_json::json!({
                "shared_secret": hex::encode(&secret),
            })))
        }
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Decapsulation failed: {}", e)
        }))),
    }
}

async fn kem_encrypt(Json(req): Json<serde_json::Value>) -> impl IntoResponse {
    let pub_key_hex = req.get("public_key").and_then(|v| v.as_str()).unwrap_or("");
    let plaintext_b64 = req.get("plaintext").and_then(|v| v.as_str()).unwrap_or("");
    
    let pub_key = match hex::decode(pub_key_hex) {
        Ok(k) => k,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid hex public key: {}", e)
        }))),
    };
    
    let plaintext = match base64::engine::general_purpose::STANDARD.decode(plaintext_b64) {
        Ok(p) => p,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid base64 plaintext: {}", e)
        }))),
    };
    
    match MlKem768::encrypt_for_recipient(&pub_key, &plaintext) {
        Ok(enc) => {
            (StatusCode::OK, Json(serde_json::json!({
                "kem_ciphertext": hex::encode(&enc.kem_ciphertext),
                "encrypted_data": base64::engine::general_purpose::STANDARD.encode(&enc.encrypted_data),
                "nonce": hex::encode(&enc.nonce),
            })))
        }
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Encryption failed: {}", e)
        }))),
    }
}

async fn kem_decrypt(Json(req): Json<serde_json::Value>) -> impl IntoResponse {
    let secret_key_hex = req.get("secret_key").and_then(|v| v.as_str()).unwrap_or("");
    let kem_ciphertext_hex = req.get("kem_ciphertext").and_then(|v| v.as_str()).unwrap_or("");
    let encrypted_data_b64 = req.get("encrypted_data").and_then(|v| v.as_str()).unwrap_or("");
    let nonce_hex = req.get("nonce").and_then(|v| v.as_str()).unwrap_or("");
    
    let secret_key = match hex::decode(secret_key_hex) {
        Ok(k) => k,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid hex secret key: {}", e)
        }))),
    };
    
    let kem_ciphertext = match hex::decode(kem_ciphertext_hex) {
        Ok(c) => c,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid hex KEM ciphertext: {}", e)
        }))),
    };
    
    let encrypted_data = match base64::engine::general_purpose::STANDARD.decode(encrypted_data_b64) {
        Ok(d) => d,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid base64 encrypted data: {}", e)
        }))),
    };
    
    let nonce = match hex::decode(nonce_hex) {
        Ok(n) => n,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid hex nonce: {}", e)
        }))),
    };
    
    let encrypted = EncryptedMessage {
        kem_ciphertext,
        encrypted_data,
        nonce,
    };
    
    match MlKem768::decrypt_for_recipient(&secret_key, &encrypted) {
        Ok(plaintext) => {
            (StatusCode::OK, Json(serde_json::json!({
                "plaintext": base64::engine::general_purpose::STANDARD.encode(&plaintext),
            })))
        }
        Err(e) => (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Decryption failed: {}", e)
        }))),
    }
}

// ============================================================================
// Main
// ============================================================================

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("qsdid_api=info")
        .init();
    
    info!("🚀 QSDID Platform API Starting...");
    
    let state = AppState {
        signatures: Arc::new(Mutex::new(HashMap::new())),
        kem_keys: Arc::new(Mutex::new(HashMap::new())),
    };
    
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);
    
    let app = Router::new()
        .route("/health", get(health))
        .route("/keys/generate", post(generate_keys))
        .route("/sign", post(sign_document))
        .route("/verify", post(verify_signature))
        .route("/signatures", get(list_signatures))
        .route("/signatures/{id}", get(get_signature))
        .route("/signatures/{id}", delete(delete_signature))
        .route("/stats", get(get_stats))
        .route("/kem/generate", post(kem_generate))
        .route("/kem/encapsulate", post(kem_encapsulate))
        .route("/kem/decapsulate", post(kem_decapsulate))
        .route("/kem/encrypt", post(kem_encrypt))
        .route("/kem/decrypt", post(kem_decrypt))
        .layer(cors)
        .with_state(state);
    
    let addr = "0.0.0.0:8080";
    info!("🌐 Listening on http://{}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
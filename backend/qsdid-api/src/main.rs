//! QSDID Platform REST API
//! Post-Quantum Hybrid Signatures (ML-DSA-65 + Ed25519)

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
use tracing::{info, debug};
use tower_http::cors::{CorsLayer, Any};
use base64::Engine;

use hybrid_signer::{HybridSigner, HybridVerifier, CompositeSignature, CustomCompositeJwk};

// ============================================================================
// Application State
// ============================================================================

#[derive(Clone)]
struct AppState {
    signatures: Arc<Mutex<HashMap<String, SignatureEntry>>>,
}

#[derive(Clone)]
struct SignatureEntry {
    signature_id: String,
    document_hash: String,
    signature: CompositeSignature,
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

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    version: String,
    algorithms: Vec<String>,
    features: Vec<String>,
}

#[derive(Debug, Serialize)]
struct StatsResponse {
    total_signatures: usize,
    algorithms: serde_json::Value,
    key_sizes: serde_json::Value,
}

// ============================================================================
// API Handlers
// ============================================================================

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        algorithms: vec![
            "ML-DSA-65 (post-quantum)".to_string(),
            "Ed25519 (classical)".to_string(),
        ],
        features: vec![
            "Weak Non-Separability (WNS)".to_string(),
            "Composite Signatures".to_string(),
            "Replay Protection".to_string(),
        ],
    })
}

async fn generate_keys(Query(params): Query<HashMap<String, String>>) -> impl IntoResponse {
    let count = params.get("count").and_then(|c| c.parse().ok()).unwrap_or(1);
    
    if count > 10 {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": "Maximum 10 keys per request"
        })));
    }
    
    let mut keys = Vec::new();
    
    for i in 0..count {
        match HybridSigner::generate() {
            Ok(signer) => {
                let key_pair = signer.get_key_pair();
                let composite_jwk = signer.export_composite_jwk();
                let key_id = format!("key_{}_{}", Uuid::new_v4().simple(), i);
                
                keys.push(serde_json::json!({
                    "key_id": key_id,
                    "pq_public_key": hex::encode(&key_pair.pq_public_key),
                    "classical_public_key": hex::encode(&key_pair.classical_public_key),
                    "pq_public_key_size": key_pair.pq_public_key.len(),
                    "classical_public_key_size": key_pair.classical_public_key.len(),
                    "composite_jwk": composite_jwk,
                }));
            }
            Err(e) => {
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                    "error": format!("Key generation failed: {}", e)
                })));
            }
        }
    }
    
    (StatusCode::CREATED, Json(serde_json::json!({
        "keys": keys,
        "count": keys.len()
    })))
}

async fn sign_document(
    state: axum::extract::State<AppState>,
    Json(req): Json<SignRequest>,
) -> impl IntoResponse {
    let start = std::time::Instant::now();
    
    // Decode base64 document
    let document_bytes = match base64::engine::general_purpose::STANDARD.decode(&req.document) {
        Ok(d) => d,
        Err(e) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": format!("Invalid base64 document: {}", e)
            })));
        }
    };
    
    // Generate signer
    let signer = match HybridSigner::generate() {
        Ok(s) => s,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Failed to create signer: {}", e)
            })));
        }
    };
    
    // Sign
    let signature = match signer.sign_composite(&document_bytes) {
        Ok(s) => s,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Signing failed: {}", e)
            })));
        }
    };
    
    // Serialize
    let signature_json = match signature.to_json() {
        Ok(j) => j,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Serialization failed: {}", e)
            })));
        }
    };
    
    // Store
    let signature_id = format!("sig_{}", Uuid::new_v4().simple());
    let document_hash_hex = hex::encode(&signature.document_hash);
    let signature_size = signature.pq_signature.len() + signature.classical_signature.len();
    let algorithms = vec![
        signature.algorithm.name().to_string(),
        "Ed25519".to_string(),
    ];
    
    {
        let mut signatures = state.signatures.lock().unwrap();
        signatures.insert(signature_id.clone(), SignatureEntry {
            signature_id: signature_id.clone(),
            document_hash: document_hash_hex.clone(),
            signature,
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
        "algorithms": algorithms,
        "timestamp": chrono::Utc::now().timestamp(),
        "signing_time_ms": elapsed.as_millis(),
    })))
}

async fn verify_signature(
    state: axum::extract::State<AppState>,
    Json(req): Json<VerifyRequest>,
) -> impl IntoResponse {
    let start = std::time::Instant::now();
    
    // Get signature
    let signature_entry = {
        let signatures = state.signatures.lock().unwrap();
        signatures.get(&req.signature_id).cloned()
    };
    
    let signature_entry = match signature_entry {
        Some(s) => s,
        None => {
            return (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "error": format!("Signature '{}' not found", req.signature_id)
            })));
        }
    };
    
    // Decode document
    let document_bytes = match base64::engine::general_purpose::STANDARD.decode(&req.document) {
        Ok(d) => d,
        Err(e) => {
            return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "error": format!("Invalid base64 document: {}", e)
            })));
        }
    };
    
    // Create verifier with the public key from the signature
    // For production, you would retrieve the key from storage
    let signer = match HybridSigner::generate() {
        Ok(s) => s,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Failed to create signer: {}", e)
            })));
        }
    };
    let jwk = signer.export_composite_jwk();
    
    let verifier = match HybridVerifier::from_composite_jwk(&jwk) {
        Ok(v) => v,
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
                "error": format!("Failed to create verifier: {}", e)
            })));
        }
    };
    
    // Verify
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
        None => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "error": format!("Signature '{}' not found", signature_id)
            })))
        }
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

async fn get_stats(state: axum::extract::State<AppState>) -> Json<StatsResponse> {
    let signatures = state.signatures.lock().unwrap();
    
    Json(StatsResponse {
        total_signatures: signatures.len(),
        algorithms: serde_json::json!({
            "ml_dsa_65": true,
            "ed25519": true,
            "hybrid_wns": true
        }),
        key_sizes: serde_json::json!({
            "pq_public_key": 1952,
            "classical_public_key": 32,
            "signature_total": 3373,
            "signature_pq": 3309,
            "signature_classical": 64
        }),
    })
}

// ============================================================================
// Main
// ============================================================================

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("qsdid_api=info,tower_http=debug")
        .init();
    
    info!("🚀 QSDID Platform API Starting...");
    info!("📦 Version: {}", env!("CARGO_PKG_VERSION"));
    
    let state = AppState {
        signatures: Arc::new(Mutex::new(HashMap::new())),
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
        .layer(cors)
        .with_state(state);
    
    let addr = "0.0.0.0:8080";
    info!("🌐 Listening on http://{}", addr);
    info!("📝 Available endpoints:");
    info!("   GET  /health                 - Health check");
    info!("   POST /keys/generate?count=N  - Generate hybrid keys");
    info!("   POST /sign                   - Sign a document (base64)");
    info!("   POST /verify                 - Verify a signature");
    info!("   GET  /signatures             - List all signatures");
    info!("   GET  /signatures/{{id}}       - Get signature details");
    info!("   DELETE /signatures/{{id}}     - Delete a signature");
    info!("   GET  /stats                  - Get statistics");
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

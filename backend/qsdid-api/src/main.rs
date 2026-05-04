//! QSDID Platform REST API
//! - Hybrid signatures (ML-DSA-65 + Ed25519) with WNS
//! - Post-quantum key exchange (ML-KEM-768) with authenticated encryption

//! QSDID Platform REST API
//! Post-Quantum Hybrid Signatures (ML-DSA-65 + Ed25519) + KEM

use axum::{
    extract::{Path, State as AxumState},
    response::{Json, IntoResponse},
    http::StatusCode,
    Router, routing::{get, post, put, delete},
};

use axum::extract::State;
use serde_json::json;
use rand::Rng;
use axum::extract::Query;
use chrono::Utc;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;
use tracing::{info};
use tower_http::cors::{CorsLayer, Any};
use base64::Engine;
use hybrid_signer::{HybridSigner, HybridVerifier, CompositeSignature, CustomCompositeJwk, HybridKeyPair};

use pqc_ml_kem::{MlKem768, EncryptedMessage, KeyPair as KemKeyPair};
use identity_did::{CoreDID, DID};
use totp_rs::{TOTP, Algorithm, Secret};


use std::fs;
use std::path::Path as StdPath;
#[derive(Debug, Deserialize)]
struct PrivateKeyData {
    pq_secret: String,
    classical_secret: String,
    pq_public: String,        // hex
    classical_public: String, // hex
}

// ============================================================================
// Application State
// ============================================================================

#[derive(Clone)]
struct AppState {
    signatures: Arc<Mutex<HashMap<String, SignatureEntry>>>,
    kem_keys: Arc<Mutex<HashMap<String, KemKeyPair>>>,
    challenges: Arc<Mutex<HashMap<String, ChallengeEntry>>>,
    dids: Arc<Mutex<HashMap<String, DIDEntry>>>,
    totp_secrets: Arc<Mutex<HashMap<String, String>>>,
    issuers: Arc<Mutex<Vec<IssuerInfo>>>, 
    credential_requests: Arc<Mutex<HashMap<String, CredentialRequest>>>,

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

#[derive(Clone)]
struct ChallengeEntry {
    nonce: String,
    expires_at: i64,
    used: bool,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialRequest {
    pub id: String,
    pub holder: String,
    pub issuer: String,
    pub credential_type: String,
    pub message: String,
    pub status: String,
    pub requested_at: i64,
    pub credential_id: Option<String>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IssuerInfo {
    pub address: String,
    pub legal_name: String,
    pub credential_types: Vec<String>,
}

const ISSUERS_FILE: &str = "issuers.json";

fn load_issuers() -> Vec<IssuerInfo> {
    if !StdPath::new(ISSUERS_FILE).exists() {
        return Vec::new();
    }
    let data = fs::read_to_string(ISSUERS_FILE).unwrap_or_default();
    serde_json::from_str(&data).unwrap_or_default()
}

fn save_issuers(issuers: &[IssuerInfo]) {
    let data = serde_json::to_string_pretty(issuers).unwrap();
    fs::write(ISSUERS_FILE, data).unwrap();
}

// ============================================================================
// Request/Response Models
// ============================================================================

#[derive(Debug, Deserialize)]
struct SignRequest {
    document: String,
    document_name: Option<String>,
    challenge_id: Option<String>,
    private_key: Option<PrivateKeyData>,   // <-- NOUVEAU CHAMP
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
// DID Models
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DIDDocument {
    pub id: String,
    pub method: String,
    pub method_id: String,
    pub controller: Option<String>,
    pub verification_methods: Vec<VerificationMethod>,
    pub authentication: Vec<String>,
    pub created: String,
    pub updated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VerificationMethod {
    pub id: String,
    pub r#type: String,
    pub controller: String,
    pub public_key_jwk: Option<serde_json::Value>,
    pub public_key_multibase: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDIDRequest {
    pub method: String,
    pub method_id: String,
    pub key_id: Option<String>,
}

#[derive(Clone)]
pub struct DIDEntry {
    pub did: String,
    pub document: DIDDocument,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub key_id: Option<String>,
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

async fn generate_challenge(
    state: axum::extract::State<AppState>,
) -> impl IntoResponse {
    
    
    // Générer un nonce sécurisé
    let nonce = Uuid::new_v4().to_string();
    
    let challenge_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let expires_at = now + 60; // Expire dans 60 secondes
    
    let challenge = ChallengeEntry {
        nonce: nonce.clone(),
        expires_at,
        used: false,
    };
    
    {
        let mut challenges = state.challenges.lock().unwrap();
        challenges.insert(challenge_id.clone(), challenge);
    }
    
    info!("Generated challenge '{}' expires at {}", challenge_id, expires_at);
    
    (StatusCode::OK, Json(serde_json::json!({
        "challenge_id": challenge_id,
        "nonce": nonce,
        "expires_at": expires_at
    })))
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
                "pq_secret_key": hex::encode(&key_pair.pq_secret_key), // Ajouté
                "classical_secret_key": hex::encode(&key_pair.classical_secret_key), // Ajouté
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

    // Vérification du challenge (inchangée)
    if let Some(challenge_id) = &req.challenge_id {
        let mut challenges = state.challenges.lock().unwrap();
        if let Some(challenge) = challenges.get_mut(challenge_id) {
            let now = chrono::Utc::now().timestamp();
            if now > challenge.expires_at {
                return (StatusCode::BAD_REQUEST, Json(json!({ "error": "Challenge expired" })));
            }
            if challenge.used {
                return (StatusCode::BAD_REQUEST, Json(json!({ "error": "Challenge already used" })));
            }
            let document_bytes = match base64::engine::general_purpose::STANDARD.decode(&req.document) {
                Ok(d) => d,
                Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("Invalid base64: {}", e) }))),
            };
            if let Ok(doc_str) = String::from_utf8(document_bytes.clone()) {
                if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&doc_str) {
                    let nonce_in_doc = json_value.get("nonce").and_then(|v| v.as_str());
                    if nonce_in_doc != Some(&challenge.nonce) {
                        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "Nonce mismatch" })));
                    }
                }
            }
            challenge.used = true;
            info!("Challenge '{}' verified and marked as used", challenge_id);
        } else {
            return (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("Challenge '{}' not found", challenge_id) })));
        }
    }

    let document_bytes = match base64::engine::general_purpose::STANDARD.decode(&req.document) {
        Ok(d) => d,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("Invalid base64: {}", e) }))),
    };

    // Création du signeur (corrigée, sans `?`)
    let signer = if let Some(pk) = req.private_key {
        let pq_secret = match hex::decode(&pk.pq_secret) {
            Ok(v) => v,
            Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("Invalid pq_secret: {}", e) }))),
        };
        let classical_secret = match hex::decode(&pk.classical_secret) {
            Ok(v) => v,
            Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("Invalid classical_secret: {}", e) }))),
        };
        let pq_public = match hex::decode(&pk.pq_public) {
            Ok(v) => v,
            Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("Invalid pq_public: {}", e) }))),
        };
        let classical_public = match hex::decode(&pk.classical_public) {
            Ok(v) => v,
            Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": format!("Invalid classical_public: {}", e) }))),
        };
        let key_pair = HybridKeyPair {
            pq_public_key: pq_public,
            pq_secret_key: pq_secret,
            classical_public_key: classical_public,
            classical_secret_key: classical_secret,
            key_id: String::new(),
            created_at: 0,
        };
        match HybridSigner::from_key_pair(&key_pair) {
            Ok(s) => s,
            Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({ "error": e.to_string() }))),
        }
    } else {
        match HybridSigner::generate() {
            Ok(s) => s,
            Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))),
        }
    };

    let public_key_jwk = signer.export_composite_jwk();

    let signature = match signer.sign_composite(&document_bytes) {
        Ok(s) => s,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Signing failed: {}", e) }))),
    };

    let signature_json = match signature.to_json() {
        Ok(j) => j,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": format!("Serialization failed: {}", e) }))),
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

    (StatusCode::CREATED, Json(json!({
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
// DID Handlers
// ============================================================================

async fn create_did(
    AxumState(state): AxumState<AppState>,
    Json(req): Json<CreateDIDRequest>,
) -> impl IntoResponse {
    
    // Valider le method name avec ta logique Rust
    if let Err(e) = identity_did::CoreDID::valid_method_name(&req.method) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid method name: {}", e)
        })));
    }
    
    // Valider le method_id
    if let Err(e) = identity_did::CoreDID::valid_method_id(&req.method_id) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid method id: {}", e)
        })));
    }
    
    // Construire le DID
    let did_string = format!("did:{}:{}", req.method, req.method_id);
    let did = match identity_did::CoreDID::parse(&did_string) {

    Ok(d) => d,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid DID: {}", e)
        }))),
    };
    
    // Vérifier si on doit lier à une clé existante
    let verification_methods = if let Some(key_id) = &req.key_id {
        let signatures = state.signatures.lock().unwrap();
        if let Some(entry) = signatures.get(key_id) {
            vec![VerificationMethod {
                id: format!("{}#{}", did_string, key_id),
                r#type: "CompositeVerificationKey2024".to_string(),
                controller: did_string.clone(),
                public_key_jwk: Some(serde_json::to_value(&entry.public_key_jwk).unwrap_or_default()),
                public_key_multibase: None,
            }]
        } else {
            vec![]
        }
    } else {
        vec![]
    };
    
    let now = chrono::Utc::now();
    let did_document = DIDDocument {
        id: did_string.clone(),
        method: req.method,
        method_id: req.method_id,
        controller: Some(did_string.clone()),
        verification_methods,
        authentication: vec![format!("{}#authentication", did_string)],
        created: now.to_rfc3339(),
        updated: now.to_rfc3339(),
    };
    
    let entry = DIDEntry {
        did: did_string.clone(),
        document: did_document.clone(),
        created_at: now,
        key_id: req.key_id,
    };
    
    {
        let mut dids = state.dids.lock().unwrap();
        dids.insert(did_string.clone(), entry);
    }
    
    info!("Created DID: {}", did_string);
    
    (StatusCode::CREATED, Json(serde_json::json!({
        "did": did_string,
        "did_document": did_document,
        "did_validation": {
            "scheme": did.scheme(),
            "method": did.method(),
            "method_id": did.method_id(),
            "authority": did.authority(),
            "is_valid": true
        }
    })))
}

async fn resolve_did(
    AxumState(state): AxumState<AppState>,
    Path(did_string): Path<String>,
) -> impl IntoResponse {
    use identity_did::DID;
    
    // Valider le format DID avec ta logique Rust
    let did = match identity_did::CoreDID::parse(&did_string) {
        Ok(d) => d,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid DID format: {}", e)
        }))),
    };
    
    let dids = state.dids.lock().unwrap();
    
    match dids.get(&did_string) {
        Some(entry) => {
            (StatusCode::OK, Json(serde_json::json!({
                "did": entry.did,
                "did_document": entry.document,
                "resolved_at": chrono::Utc::now().to_rfc3339(),
                "validation": {
                    "scheme": did.scheme(),
                    "method": did.method(),
                    "method_id": did.method_id(),
                    "authority": did.authority()
                }
            })))
        }
        None => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": format!("DID '{}' not found", did_string)
        }))),
    }
}

async fn validate_did(
    Path(did_string): Path<String>,
) -> impl IntoResponse {
    use identity_did::DID;
    
    match identity_did::CoreDID::parse(&did_string) {
        Ok(did) => {
            (StatusCode::OK, Json(serde_json::json!({
                "valid": true,
                "did": did_string,
                "scheme": did.scheme(),
                "method": did.method(),
                "method_id": did.method_id(),
                "authority": did.authority(),
                "normalized": did.as_str(),
            })))
        }
        Err(e) => {
            (StatusCode::BAD_REQUEST, Json(serde_json::json!({
                "valid": false,
                "error": e.to_string()
            })))
        }
    }
}

async fn list_dids(
    AxumState(state): AxumState<AppState>,
) -> impl IntoResponse {
    let dids = state.dids.lock().unwrap();
    
    let did_list: Vec<_> = dids.iter().map(|(id, entry)| {
        serde_json::json!({
            "did": id,
            "method": entry.document.method,
            "method_id": entry.document.method_id,
            "created_at": entry.created_at.to_rfc3339(),
            "verification_methods": entry.document.verification_methods.len(),
            "linked_key": entry.key_id,
        })
    }).collect();
    
    Json(serde_json::json!({
        "dids": did_list,
        "count": did_list.len()
    }))
}

async fn create_did_from_key(
    AxumState(state): AxumState<AppState>,
    Path(key_id): Path<String>,
) -> impl IntoResponse {
    use identity_did::DID;
    
    // Récupérer la clé publique
    let public_key_jwk = {
        let signatures = state.signatures.lock().unwrap();
        match signatures.get(&key_id) {
            Some(entry) => entry.public_key_jwk.clone(),
            None => return (StatusCode::NOT_FOUND, Json(serde_json::json!({
                "error": format!("Key '{}' not found", key_id)
            }))),
        }
    };
    
    // Générer un method_id basé sur la clé (UUID court)
    let method_id = format!("key-{}", key_id);
    let did_string = format!("did:qsid:{}", method_id);
    
    let did = match identity_did::CoreDID::parse(&did_string) {
        Ok(d) => d,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({
            "error": format!("Failed to create DID: {}", e)
        }))),
    };
    
    let now = chrono::Utc::now();
    let did_document = DIDDocument {
        id: did_string.clone(),
        method: "qsid".to_string(),
        method_id: method_id.clone(),
        controller: Some(did_string.clone()),
        verification_methods: vec![VerificationMethod {
            id: format!("{}#{}", did_string, key_id),
            r#type: "CompositeVerificationKey2024".to_string(),
            controller: did_string.clone(),
            public_key_jwk: Some(serde_json::to_value(&public_key_jwk).unwrap_or_default()),
            public_key_multibase: None,
        }],
        authentication: vec![format!("{}#authentication", did_string)],
        created: now.to_rfc3339(),
        updated: now.to_rfc3339(),
    };
    
    let entry = DIDEntry {
        did: did_string.clone(),
        document: did_document,
        created_at: now,
        key_id: Some(key_id.clone()),
    };
    
    {
        let mut dids = state.dids.lock().unwrap();
        dids.insert(did_string.clone(), entry);
    }
    
    info!("Created DID from key {}: {}", key_id, did_string);
    
    (StatusCode::CREATED, Json(serde_json::json!({
        "did": did_string,
        "did_document": {
            "id": did_string,
            "verification_methods_count": 1,
            "created": now.to_rfc3339()
        },
        "linked_key": key_id
    })))
}

async fn delete_did(
    AxumState(state): AxumState<AppState>,
    Path(did_string): Path<String>,
) -> impl IntoResponse {
    let mut dids = state.dids.lock().unwrap();
    
    if dids.remove(&did_string).is_some() {
        info!("Deleted DID: {}", did_string);
        (StatusCode::OK, Json(serde_json::json!({
            "message": format!("DID '{}' deleted", did_string)
        })))
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": format!("DID '{}' not found", did_string)
        })))
    }
}

async fn update_did_document(
    AxumState(state): AxumState<AppState>,
    Path(did_string): Path<String>,
    Json(updates): Json<serde_json::Value>,
) -> impl IntoResponse {
    use identity_did::DID;
    
    // Valider le format DID
    if let Err(e) = identity_did::CoreDID::parse(&did_string) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid DID format: {}", e)
        })));
    }
    
    let mut dids = state.dids.lock().unwrap();
    
    if let Some(entry) = dids.get_mut(&did_string) {
        // Mettre à jour le document DID
        if let Some(controller) = updates.get("controller").and_then(|v| v.as_str()) {
            entry.document.controller = Some(controller.to_string());
        }
        
        if let Some(_verification_methods) = updates.get("verification_methods") {
            // Ici tu pourrais ajouter une logique plus complexe pour mettre à jour les méthodes
            info!("Updating verification methods for DID: {}", did_string);
        }
        
        // Mettre à jour le timestamp
        entry.document.updated = chrono::Utc::now().to_rfc3339();
        
        (StatusCode::OK, Json(serde_json::json!({
            "message": format!("DID '{}' updated", did_string),
            "did_document": entry.document
        })))
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": format!("DID '{}' not found", did_string)
        })))
    }
}

async fn get_did_document(
    AxumState(state): AxumState<AppState>,
    Path(did_string): Path<String>,
) -> impl IntoResponse {
    use identity_did::DID;
    
    // Valider le format DID
    if let Err(e) = identity_did::CoreDID::parse(&did_string) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({
            "error": format!("Invalid DID format: {}", e)
        })));
    }
    
    let dids = state.dids.lock().unwrap();
    
    match dids.get(&did_string) {
        Some(entry) => {
            (StatusCode::OK, Json(serde_json::json!({
                "@context": "https://www.w3.org/ns/did/v1",
                "id": entry.document.id,
                "controller": entry.document.controller,
                "verificationMethod": entry.document.verification_methods,
                "authentication": entry.document.authentication,
                "created": entry.document.created,
                "updated": entry.document.updated
            })))
        }
        None => (StatusCode::NOT_FOUND, Json(serde_json::json!({
            "error": format!("DID '{}' not found", did_string)
        }))),
    }
}



// ------------------------------------------------------------------------
// TOTP handlers (Google Authenticator)
// ------------------------------------------------------------------------

async fn create_credential_request(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> impl IntoResponse {
    let holder = req.get("holder").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let issuer = req.get("issuer").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let credential_type = req.get("credentialType").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let message = req.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string();

    if holder.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "Missing field: holder" })));
    }
    if issuer.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "Missing field: issuer" })));
    }
    if credential_type.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "Missing field: credentialType" })));
    }

    if holder.is_empty() || issuer.is_empty() || credential_type.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "Missing fields" })));
    }

    let id = Uuid::new_v4().to_string();
    let request = CredentialRequest {
        id: id.clone(),
        holder,
        issuer,
        credential_type,
        message,
        status: "pending".to_string(),
        requested_at: Utc::now().timestamp(),
        credential_id: None,
    };

    {
        let mut requests = state.credential_requests.lock().unwrap();
        requests.insert(id.clone(), request);
        save_credential_requests(&requests); // ← PERSISTANCE
    }

    (StatusCode::CREATED, Json(json!({ "id": id, "status": "pending" })))
}




async fn update_credential_request(

    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<serde_json::Value>,
) -> impl IntoResponse {
    let new_status = req.get("status").and_then(|v| v.as_str()).unwrap_or("");
    let credential_id = req.get("credentialId").and_then(|v| v.as_str()).map(|s| s.to_string());

    let mut requests = state.credential_requests.lock().unwrap();
    if let Some(r) = requests.get_mut(&id) {
        r.status = new_status.to_string();
        if let Some(cid) = credential_id {
            r.credential_id = Some(cid);
        }
        save_credential_requests(&requests); // ← PERSISTANCE
        (StatusCode::OK, Json(json!({ "success": true })))
    } else {
        (StatusCode::NOT_FOUND, Json(json!({ "error": "Request not found" })))
    }
}

// GET /issuers
async fn list_issuers(State(state): State<AppState>) -> impl IntoResponse {
    let issuers = state.issuers.lock().unwrap();
    Json(json!({ "issuers": *issuers }))
}

// POST /issuers
async fn register_issuer(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> impl IntoResponse {
    let address = req.get("address").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let legal_name = req.get("legalName").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let credential_types: Vec<String> = req.get("credentialTypes")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
        .unwrap_or_default();

    if address.is_empty() || legal_name.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "address and legalName required" })));
    }

    let mut issuers = state.issuers.lock().unwrap();
    // Mettre à jour ou ajouter l’issuer
    if let Some(existing) = issuers.iter_mut().find(|i| i.address == address) {
        existing.legal_name = legal_name;
        existing.credential_types = credential_types;
    } else {
        issuers.push(IssuerInfo {
            address,
            legal_name,
            credential_types,
        });
    }
    save_issuers(&issuers);

    (StatusCode::OK, Json(json!({ "success": true })))
}

// ------------------------------------------------------------------------
// TOTP handlers (Google Authenticator)
// ------------------------------------------------------------------------

async fn totp_setup(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> impl IntoResponse {
    let user_id = req
        .get("userId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if user_id.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "userId required" })));
    }

    let secret_bytes: [u8; 20] = rand::random();
    let secret_base32 = base32::encode(base32::Alphabet::Rfc4648 { padding: false }, &secret_bytes);

    let otpauth_url = format!(
        "otpauth://totp/QS-DID:{}?secret={}&issuer=QS-DID&algorithm=SHA1&digits=6&period=30",
        user_id, secret_base32
    );

    {
        let mut totp_secrets = state.totp_secrets.lock().unwrap();
        totp_secrets.insert(user_id.clone(), secret_base32.clone());
        save_totp_secrets(&totp_secrets); // ← AJOUT
    }

    (StatusCode::OK, Json(json!({
        "otpauthUrl": otpauth_url,
        "secret": secret_base32,
    })))
}
async fn totp_verify(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> impl IntoResponse {
    let user_id = req
        .get("userId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let token = req
        .get("token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if user_id.is_empty() || token.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "userId and token required" })));
    }

    let secret_base32 = {
        let totp_secrets = state.totp_secrets.lock().unwrap();
        totp_secrets.get(&user_id).cloned()
    };
    let secret_base32 = match secret_base32 {
        Some(s) => s,
        None => return (StatusCode::NOT_FOUND, Json(json!({ "error": "TOTP not set up" }))),
    };

    let secret_bytes = base32::decode(base32::Alphabet::Rfc4648 { padding: false }, &secret_base32)
        .unwrap_or(vec![]);
    if secret_bytes.is_empty() {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": "Invalid secret" })));
    }

    let totp = TOTP::new(
        totp_rs::Algorithm::SHA1,
        6,
        1,
        30,
        secret_bytes,
    )
    .unwrap();

    let verified = totp.check_current(&token).unwrap_or(false);

    if verified {
        (StatusCode::OK, Json(json!({ "success": true })))
    } else {
        (StatusCode::UNAUTHORIZED, Json(json!({ "error": "Invalid TOTP code" })))
    }
}

async fn totp_store(
    State(state): State<AppState>,
    Json(req): Json<serde_json::Value>,
) -> impl IntoResponse {
    let user_id = req.get("userId").and_then(|v| v.as_str()).unwrap_or("");
    let secret = req.get("secret").and_then(|v| v.as_str()).unwrap_or("");
    if user_id.is_empty() || secret.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "userId and secret required" })));
    }
    {
        let mut totp_secrets = state.totp_secrets.lock().unwrap();
        totp_secrets.insert(user_id.to_string(), secret.to_string());
        save_totp_secrets(&totp_secrets); // ← AJOUT
    }
    (StatusCode::OK, Json(json!({ "success": true })))
}
const TOTP_FILE: &str = "totp_secrets.json";

fn load_totp_secrets() -> HashMap<String, String> {
    if !StdPath::new(TOTP_FILE).exists() {
        return HashMap::new();
    }
    let data = fs::read_to_string(TOTP_FILE).unwrap_or_default();
    serde_json::from_str(&data).unwrap_or_default()
}

fn save_totp_secrets(secrets: &HashMap<String, String>) {
    let data = serde_json::to_string_pretty(secrets).unwrap();
    fs::write(TOTP_FILE, data).unwrap();
}

const CREDENTIAL_REQUESTS_FILE: &str = "credential_requests.json";

fn load_credential_requests() -> HashMap<String, CredentialRequest> {
    if !StdPath::new(CREDENTIAL_REQUESTS_FILE).exists() {
        return HashMap::new();
    }
    let data = fs::read_to_string(CREDENTIAL_REQUESTS_FILE).unwrap_or_default();
    serde_json::from_str(&data).unwrap_or_default()
}

async fn get_credential_requests(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let issuer = params.get("issuer").cloned();
    let holder = params.get("holder").cloned();
    let requests = state.credential_requests.lock().unwrap();
    let filtered: Vec<CredentialRequest> = requests
        .values()
        .filter(|r| {
            let issuer_match = if let Some(ref iss) = issuer { r.issuer == *iss } else { true };
            let holder_match = if let Some(ref hol) = holder { r.holder == *hol } else { true };
            issuer_match && holder_match
        })
        .cloned()
        .collect();
    Json(json!({ "requests": filtered }))
}

fn save_credential_requests(requests: &HashMap<String, CredentialRequest>) {
    let data = serde_json::to_string_pretty(requests).unwrap();
    fs::write(CREDENTIAL_REQUESTS_FILE, data).unwrap();
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
        challenges: Arc::new(Mutex::new(HashMap::new())),
        dids: Arc::new(Mutex::new(HashMap::new())),
        totp_secrets: Arc::new(Mutex::new(load_totp_secrets())), 
        issuers: Arc::new(Mutex::new(load_issuers())), 
        credential_requests: Arc::new(Mutex::new(load_credential_requests())),


    };
    
    let cors = CorsLayer::new()
        .allow_origin(Any)  // ← Permet toutes les origines
        .allow_methods(Any)
        .allow_headers(Any);
    
    let app = Router::new()
        .route("/health", get(health))
        .route("/challenge", post(generate_challenge))
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
        .route("/did/create", post(create_did))
        .route("/did/validate/:did", get(validate_did))
        .route("/did/resolve/:did", get(resolve_did))
        .route("/did/list", get(list_dids))
        .route("/did/from-key/:key_id", post(create_did_from_key))
        .route("/did/:did", delete(delete_did))
        .route("/did/:did", get(get_did_document))
        .route("/did/:did", put(update_did_document))
        .route("/api/totp/setup", post(totp_setup))
        .route("/api/totp/verify", post(totp_verify))
        .route("/api/totp/store", post(totp_store))
        .route("/credential-requests", post(create_credential_request))
        .route("/credential-requests", get(get_credential_requests))
        .route("/credential-requests/{id}", put(update_credential_request))
        .route("/issuers", get(list_issuers))
        .route("/issuers", post(register_issuer))
        .layer(cors)
        .with_state(state);

    let addr = "0.0.0.0:8083";
    info!("🌐 Listening on http://{}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
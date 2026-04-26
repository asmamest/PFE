use reqwest::Client;
use serde::{Serialize, Deserialize};
use serde_json::json;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CredentialData {
    pub claims: serde_json::Value,
    pub metadata: Metadata,
    pub ai_result: AiResult,
    pub image: Option<Vec<u8>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Metadata {
    pub credential_type: String,
    pub issuer_did: String,
    pub holder_did: String,
    pub uuid: String,
    pub issued_at: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiResult {
    pub fraud_score: f64,
    pub heatmap_hash: String,
    pub analysis_timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StoreResponse {
    pub success: bool,
    #[serde(rename = "credentialId")]
    pub credential_id: String,
    #[serde(rename = "rootCid")]
    pub root_cid: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RetrieveResponse {
    pub success: bool,
    #[serde(rename = "rootCid")]
    pub root_cid: String,
    pub metadata: serde_json::Value,
    pub claims: serde_json::Value,
    pub image: Option<String>,
    #[serde(rename = "signatureValid")]
    pub signature_valid: bool,
}

pub struct StorageClient {
    base_url: String,
    client: Client,
}

impl StorageClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: Client::new(),
        }
    }
    
    pub async fn store_credential(
        &self,
        credential: &CredentialData,
        signature_base64: String,
    ) -> Result<StoreResponse, String> {
        let url = format!("{}/api/v1/store", self.base_url);
        
        let payload = json!({
            "claims": credential.claims,
            "metadata": {
                "type": credential.metadata.credential_type,
                "issuer": credential.metadata.issuer_did,
                "holder": credential.metadata.holder_did,
                "credentialId": credential.metadata.uuid,
                "issued_at": credential.metadata.issued_at,
                "expires_at": credential.metadata.expires_at,
                "ai_result": {
                    "fraud_score": credential.ai_result.fraud_score,
                    "heatmap_hash": credential.ai_result.heatmap_hash,
                    "analysis_timestamp": credential.ai_result.analysis_timestamp,
                }
            },
            "signature": signature_base64,
        });
        
        let response = self.client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;
        
        let status = response.status();
        
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("HTTP {}: {}", status, error_text));
        }
        
        let store_response: StoreResponse = response.json()
            .await
            .map_err(|e| format!("JSON parse error: {}", e))?;
        
        Ok(store_response)
    }
    
    pub async fn retrieve_credential(
        &self,
        root_cid: &str,
        issuer_pub_key_hex: &str,
    ) -> Result<RetrieveResponse, String> {
        let url = format!(
            "{}/api/v1/retrieve/{}?issuerPubKey={}",
            self.base_url, root_cid, issuer_pub_key_hex
        );
        
        let response = self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        
        let status = response.status();
        
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("HTTP {}: {}", status, error_text));
        }
        
        let retrieve_response: RetrieveResponse = response.json()
            .await
            .map_err(|e| format!("JSON parse error: {}", e))?;
        
        Ok(retrieve_response)
    }
    
    pub async fn health_check(&self) -> Result<bool, String> {
        let response = self.client
            .get(&format!("{}/health", self.base_url))
            .send()
            .await
            .map_err(|e| e.to_string())?;
        Ok(response.status().is_success())
    }
}

impl Default for StorageClient {
    fn default() -> Self {
        Self::new("http://localhost:3500")
    }
}

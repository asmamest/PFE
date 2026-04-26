use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),
    
    #[error("JSON serialization failed: {0}")]
    JsonError(#[from] serde_json::Error),
    
    #[error("IPFS operation failed: {0}")]
    IpfsError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreResponse {
    pub root_cid: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetrieveResponse {
    pub claims: String,
    pub image: Option<String>,
    pub metadata: CredentialMetadata,
    pub signature_valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialMetadata {
    #[serde(rename = "type")]
    pub cred_type: String,
    pub issuer: String,
    pub holder: String,
    pub issued_at: String,
    pub encryption: EncryptionMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionMetadata {
    pub claims_nonce: String,
    pub claims_salt: String,
    pub image_nonce: Option<String>,
    pub image_salt: Option<String>,
}

pub struct StorageClient {
    base_url: String,
    client: reqwest::Client,
}

impl StorageClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: reqwest::Client::new(),
        }
    }
    
    pub async fn store_credential(
        &self,
        claims_encrypted: Vec<u8>,
        image_encrypted: Option<Vec<u8>>,
        signature: Vec<u8>,
        metadata: CredentialMetadata,
    ) -> Result<StoreResponse, StorageError> {
        let url = format!("{}/api/v1/store", self.base_url);
        
        let metadata_json = serde_json::to_string(&metadata)?;
        
        let mut form = Form::new()
            .part("claims", Part::bytes(claims_encrypted)
                .file_name("claims.json.enc")
                .mime_str("application/octet-stream")?)
            .part("signature", Part::bytes(signature)
                .file_name("signature.ml-dsa")
                .mime_str("application/octet-stream")?)
            .text("metadata", metadata_json);
        
        if let Some(img) = image_encrypted {
            form = form.part("image", Part::bytes(img)
                .file_name("image.enc")
                .mime_str("application/octet-stream")?);
        }
        
        let response = self.client
            .post(&url)
            .multipart(form)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(StorageError::IpfsError(error_text));
        }
        
        Ok(response.json().await?)
    }
    
    pub async fn retrieve_credential(
        &self,
        root_cid: &str,
    ) -> Result<RetrieveResponse, StorageError> {
        let url = format!("{}/api/v1/retrieve/{}", self.base_url, root_cid);
        
        let response = self.client
            .get(&url)
            .send()
            .await?;
        
        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(StorageError::IpfsError(error_text));
        }
        
        Ok(response.json().await?)
    }
    
    pub async fn health_check(&self) -> Result<bool, StorageError> {
        let url = format!("{}/health", self.base_url);
        let response = self.client.get(&url).send().await?;
        Ok(response.status().is_success())
    }
}
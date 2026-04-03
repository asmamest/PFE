use oqs::sig::{Sig, Algorithm};
use anyhow::{anyhow, Result};

pub struct PqcSigner {
    sig: Sig,
    secret_key: Vec<u8>,
    public_key: Vec<u8>,
}

impl PqcSigner {
    pub fn generate() -> Result<Self> {
        let sig = Sig::new(Algorithm::MlDsa65)?;
        let (public_key, secret_key) = sig.keypair()?;
        
        Ok(Self {
            sig,
            secret_key: secret_key.into_vec(),
            public_key: public_key.into_vec(),
        })
    }
    
    pub fn from_bytes(secret_key_bytes: Vec<u8>, public_key_bytes: Vec<u8>) -> Result<Self> {
        let sig = Sig::new(Algorithm::MlDsa65)?;
        
        let _sk = sig.secret_key_from_bytes(&secret_key_bytes)
            .ok_or(anyhow!("Invalid secret key"))?;
        let _pk = sig.public_key_from_bytes(&public_key_bytes)
            .ok_or(anyhow!("Invalid public key"))?;
        
        Ok(Self {
            sig,
            secret_key: secret_key_bytes,
            public_key: public_key_bytes,
        })
    }
    
    pub fn sign(&self, message: &[u8]) -> Result<Vec<u8>> {
        let sk = self.sig.secret_key_from_bytes(&self.secret_key)
            .ok_or(anyhow!("Invalid secret key"))?;
        
        let signature = self.sig.sign(message, sk)?;
        Ok(signature.into_vec())
    }
    
    pub fn verify(&self, message: &[u8], signature: &[u8]) -> Result<bool> {
        let pk = self.sig.public_key_from_bytes(&self.public_key)
            .ok_or(anyhow!("Invalid public key"))?;
        
        let sig = self.sig.signature_from_bytes(signature)
            .ok_or(anyhow!("Invalid signature"))?;
        
        match self.sig.verify(message, sig, pk) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false),
        }
    }
    
    pub fn public_key_bytes(&self) -> &[u8] {
        &self.public_key
    }
    
    pub fn secret_key_bytes(&self) -> &[u8] {
        &self.secret_key
    }
}
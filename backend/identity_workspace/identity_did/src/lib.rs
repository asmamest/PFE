

//! DID (Decentralized Identifier) implementation for the IOTA Identity framework.
mod did;
mod did_url;
mod error;
mod did_jwk;
mod did_compositejwk;

// Re-export public types
pub use did::CoreDID;
pub use did::DID;
pub use did_url::DIDUrl;
pub use error::Error;

 
/// The serialization format used for the JWS.
#[derive(Clone, Copy, Debug, Hash, PartialEq, Eq, PartialOrd, Ord, Default)]
pub enum JwsFormat {
  /// JWS Compact Serialization (<https://www.rfc-editor.org/rfc/rfc7515#section-3.1>).
  #[default]
  Compact,
  /// General JWS JSON Serialization (<https://www.rfc-editor.org/rfc/rfc7515#section-7.2.1>).
  General,
  /// Flattened JWS JSON Serialization (<https://www.rfc-editor.org/rfc/rfc7515#section-7.2.2>).
  ///
  /// Should be used for single signature or MAC use cases.
  Flatten,
}

/**
 * QSDID Authentication State Machine Definition
 * 
 * Implements a deterministic state machine for authentication flows
 * All transitions must be explicit and event-driven
 */

export const AuthenticationStates = {
  // Initial state
  INIT: 'INIT',
  
  // Challenge phase
  CHALLENGE_GENERATED: 'CHALLENGE_GENERATED',
  
  // Local Proof of Presence
  LPP_PENDING: 'LPP_PENDING',
  LPP_VERIFIED: 'LPP_VERIFIED',
  LPP_REJECTED: 'LPP_REJECTED',
  
  // Key generation (registration only)
  KEY_GENERATED: 'KEY_GENERATED',
  KEY_GENERATION_FAILED: 'KEY_GENERATION_FAILED',
  
  // Signature phase
  SIGNED: 'SIGNED',
  SIGNATURE_INVALID: 'SIGNATURE_INVALID',
  
  // Verification
  VERIFIED: 'VERIFIED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  
  // Wallet binding
  WALLET_CONNECTIONS_PENDING: 'WALLET_CONNECTIONS_PENDING',
  WALLET_CONNECTED: 'WALLET_CONNECTED',
  WALLET_CONNECTION_FAILED: 'WALLET_CONNECTION_FAILED',
  
  // Final states
  IDENTITY_BOUND: 'IDENTITY_BOUND',
  AUTHENTICATED: 'AUTHENTICATED',
  
  // Error/Recovery states
  EXPIRED: 'EXPIRED',
  REPLAY_DETECTED: 'REPLAY_DETECTED',
  SESSION_REVOKED: 'SESSION_REVOKED',
};

/**
 * State transition rules
 * Defines valid transitions from each state
 */
export const StateTransitions = {
  [AuthenticationStates.INIT]: [
    AuthenticationStates.CHALLENGE_GENERATED,
  ],
  
  [AuthenticationStates.CHALLENGE_GENERATED]: [
    AuthenticationStates.LPP_PENDING,
    AuthenticationStates.EXPIRED,
  ],
  
  [AuthenticationStates.LPP_PENDING]: [
    AuthenticationStates.LPP_VERIFIED,
    AuthenticationStates.LPP_REJECTED,
    AuthenticationStates.EXPIRED,
  ],
  
  [AuthenticationStates.LPP_VERIFIED]: [
    AuthenticationStates.KEY_GENERATED, // registration
    AuthenticationStates.SIGNED, // login
    AuthenticationStates.EXPIRED,
  ],
  
  [AuthenticationStates.KEY_GENERATED]: [
    AuthenticationStates.SIGNED,
    AuthenticationStates.KEY_GENERATION_FAILED,
  ],
  
  [AuthenticationStates.SIGNED]: [
    AuthenticationStates.VERIFIED,
    AuthenticationStates.SIGNATURE_INVALID,
    AuthenticationStates.REPLAY_DETECTED,
  ],
  
  [AuthenticationStates.VERIFIED]: [
    AuthenticationStates.WALLET_CONNECTIONS_PENDING,
    AuthenticationStates.AUTHENTICATED, // already bound
  ],
  
  [AuthenticationStates.WALLET_CONNECTIONS_PENDING]: [
    AuthenticationStates.WALLET_CONNECTED,
    AuthenticationStates.WALLET_CONNECTION_FAILED,
  ],
  
  [AuthenticationStates.WALLET_CONNECTED]: [
    AuthenticationStates.IDENTITY_BOUND,
  ],
  
  [AuthenticationStates.IDENTITY_BOUND]: [
    AuthenticationStates.AUTHENTICATED,
  ],
  
  // Error states can transition to recovery (re-init)
  [AuthenticationStates.LPP_REJECTED]: [],
  [AuthenticationStates.KEY_GENERATION_FAILED]: [],
  [AuthenticationStates.SIGNATURE_INVALID]: [],
  [AuthenticationStates.VERIFICATION_FAILED]: [],
  [AuthenticationStates.WALLET_CONNECTION_FAILED]: [],
  [AuthenticationStates.EXPIRED]: [],
  [AuthenticationStates.REPLAY_DETECTED]: [],
  [AuthenticationStates.SESSION_REVOKED]: [],
};

/**
 * Flow-specific state paths
 */
export const RegistrationFlowStates = [
  AuthenticationStates.INIT,
  AuthenticationStates.CHALLENGE_GENERATED,
  AuthenticationStates.LPP_PENDING,
  AuthenticationStates.LPP_VERIFIED,
  AuthenticationStates.KEY_GENERATED,
  AuthenticationStates.SIGNED,
  AuthenticationStates.VERIFIED,
  AuthenticationStates.WALLET_CONNECTIONS_PENDING,
  AuthenticationStates.WALLET_CONNECTED,
  AuthenticationStates.IDENTITY_BOUND,
  AuthenticationStates.AUTHENTICATED,
];

export const LoginFlowStates = [
  AuthenticationStates.INIT,
  AuthenticationStates.CHALLENGE_GENERATED,
  AuthenticationStates.LPP_PENDING,
  AuthenticationStates.LPP_VERIFIED,
  AuthenticationStates.SIGNED,
  AuthenticationStates.VERIFIED,
  AuthenticationStates.WALLET_CONNECTIONS_PENDING,
  AuthenticationStates.WALLET_CONNECTED,
  AuthenticationStates.AUTHENTICATED,
];

/**
 * Event types that trigger state transitions
 */
export const AuthenticationEvents = {
  INITIALIZE: 'INITIALIZE',
  CHALLENGE_CREATED: 'CHALLENGE_CREATED',
  REQUEST_LPP: 'REQUEST_LPP',
  LPP_APPROVED: 'LPP_APPROVED',
  LPP_DENIED: 'LPP_DENIED',
  GENERATE_KEYS: 'GENERATE_KEYS',
  KEYS_GENERATED: 'KEYS_GENERATED',
  SIGN_CHALLENGE: 'SIGN_CHALLENGE',
  SIGNATURE_CREATED: 'SIGNATURE_CREATED',
  VERIFY_SIGNATURE: 'VERIFY_SIGNATURE',
  SIGNATURE_VERIFIED: 'SIGNATURE_VERIFIED',
  CONNECT_WALLET: 'CONNECT_WALLET',
  WALLET_CONNECTED_EVENT: 'WALLET_CONNECTED_EVENT', // renamed to avoid conflict
  BIND_IDENTITY: 'BIND_IDENTITY',
  IDENTITY_BOUND_EVENT: 'IDENTITY_BOUND_EVENT',
  ISSUE_TOKEN: 'ISSUE_TOKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  REPLAY_ATTACK_DETECTED: 'REPLAY_ATTACK_DETECTED',
  SESSION_REVOKE_REQUEST: 'SESSION_REVOKE_REQUEST',
};

/**
 * Error classifications
 */
export const ErrorClassifications = {
  SECURITY: 'SECURITY',
  SESSION: 'SESSION',
  CRYPTOGRAPHY: 'CRYPTOGRAPHY',
  WALLET: 'WALLET',
  IDENTITY: 'IDENTITY',
  VALIDATION: 'VALIDATION',
  INTEGRATION: 'INTEGRATION',
};

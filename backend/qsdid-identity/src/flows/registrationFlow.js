/**
 * Registration Flow
 * 
 * Complete registration workflow:
 * 1. Session initialization with challenge
 * 2. Local Proof of Presence verification
 * 3. Device-bound key pair generation
 * 4. Challenge signature
 * 5. Server signature verification
 * 6. Wallet binding
 * 7. Identity creation and DID generation
 * 8. Session finalization and token issuance
 */

import { AuthenticationStates, AuthenticationEvents } from '../state/states.js';

export class RegistrationFlow {
  constructor(services) {
    this.sessionManager = services.sessionManager;
    this.stateMachine = services.stateMachine;
    this.keyManager = services.keyManager;
    this.walletBinding = services.walletBinding;
    this.identityService = services.identityService;
    this.auditLogger = services.auditLogger;
  }

  /**
   * STEP 1: Initialize registration session
   * @returns { sessionId, challenge, expiresAt }
   */
  async initializeRegistration(deviceMetadata = {}) {
    try {
      // Create session with challenge
      const session = this.sessionManager.initializeSession('registration', deviceMetadata);

      // Update state machine
      const stateTransition = await this.stateMachine.transition(
        AuthenticationEvents.INITIALIZE,
        { sessionId: session.sessionId }
      );

      if (!stateTransition.success) {
        throw new Error(`State transition failed: ${stateTransition.error}`);
      }

      // Update session state
      this.sessionManager.updateSessionState(
        session.sessionId,
        AuthenticationStates.CHALLENGE_GENERATED
      );

      this.auditLogger.logAuthentication('REGISTRATION_STARTED', session.sessionId, {
        flowType: 'registration',
        deviceMetadata,
      });

      return {
        sessionId: session.sessionId,
        challenge: session.challenge,
        expiresAt: session.expiresAt,
        status: 'CHALLENGE_GENERATED',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(null, `Registration initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 2: Request Local Proof of Presence (LPP)
   * User must approve via authenticator app
   */
  async requestLocalProofOfPresence(sessionId) {
    try {
      const session = this.sessionManager.getSession(sessionId);

      // Update state machine
      const stateTransition = await this.stateMachine.transition(
        AuthenticationEvents.REQUEST_LPP,
        { sessionId }
      );

      if (!stateTransition.success) {
        throw new Error(`Cannot request LPP in current state`);
      }

      // Update session
      this.sessionManager.updateSessionState(sessionId, AuthenticationStates.LPP_PENDING);

      // Simulate LPP challenge generation
      const lppChallengeId = this._generateLPPChallengeId();
      this.sessionManager.bindPhoneApproval(sessionId, lppChallengeId);

      this.auditLogger.logAuthentication('LPP_REQUESTED', sessionId);

      return {
        sessionId,
        lppChallengeId,
        status: 'LPP_PENDING',
        message: 'Check your authenticator app to approve this registration',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `LPP request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 3: Approve Local Proof of Presence
   * User approves via authenticator app
   */
  async approveLocalProofOfPresence(sessionId, approvalToken) {
    try {
      const session = this.sessionManager.getSession(sessionId);

      // Simulate verification of approval token
      const isValid = this._verifyLPPApprovalToken(approvalToken);
      if (!isValid) {
        const transition = await this.stateMachine.transition(
          AuthenticationEvents.LPP_DENIED,
          { sessionId }
        );
        this.sessionManager.updateSessionState(sessionId, AuthenticationStates.LPP_REJECTED);
        throw new Error('Invalid LPP approval token');
      }

      // Update state machine
      const stateTransition = await this.stateMachine.transition(
        AuthenticationEvents.LPP_APPROVED,
        { sessionId }
      );

      if (!stateTransition.success) {
        throw new Error(`Cannot approve LPP in current state`);
      }

      this.sessionManager.updateSessionState(sessionId, AuthenticationStates.LPP_VERIFIED);

      this.auditLogger.logAuthentication('LPP_APPROVED', sessionId, { approvalToken });

      return {
        sessionId,
        status: 'LPP_VERIFIED',
        nextStep: 'Generate device keys',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `LPP approval failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 4: Generate device-bound key pair
   * Creates FIDO-like keys (private key non-exportable)
   */
  async generateDeviceKeys(sessionId, deviceIdentifier, deviceMetadata = {}) {
    try {
      const session = this.sessionManager.getSession(sessionId);

      // Generate key pair
      const keyPair = this.keyManager.generateDeviceKeyPair(deviceIdentifier, deviceMetadata);

      // Update state machine
      const stateTransition = await this.stateMachine.transition(
        AuthenticationEvents.GENERATE_KEYS,
        { sessionId, keyId: keyPair.keyId }
      );

      if (!stateTransition.success) {
        throw new Error(`Cannot generate keys in current state`);
      }

      this.sessionManager.updateSessionState(
        sessionId,
        AuthenticationStates.KEY_GENERATED,
        { publicKeyRegistered: keyPair.publicKey }
      );

      this.auditLogger.logCryptography('KEY_GENERATION', deviceIdentifier, {
        sessionId,
        keyId: keyPair.keyId,
      });

      return {
        sessionId,
        keyId: keyPair.keyId,
        publicKey: keyPair.publicKey,
        attestation: keyPair.attestation,
        status: 'KEY_GENERATED',
        nextStep: 'Sign challenge',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `Key generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 5: Sign challenge with device private key
   */
  async signChallenge(sessionId, deviceIdentifier, keyId) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      const challenge = session.challenge;

      // Sign challenge using device private key (non-exportable)
      const signatureResult = this.keyManager.signChallenge(
        deviceIdentifier,
        keyId,
        challenge
      );

      // Update state machine
      const stateTransition = await this.stateMachine.transition(
        AuthenticationEvents.SIGN_CHALLENGE,
        { sessionId, signature: signatureResult.signature }
      );

      if (!stateTransition.success) {
        throw new Error(`Cannot sign challenge in current state`);
      }

      this.sessionManager.updateSessionState(sessionId, AuthenticationStates.SIGNED);

      this.auditLogger.logCryptography('SIGNATURE_CREATION', deviceIdentifier, {
        sessionId,
        keyId,
      });

      return {
        sessionId,
        signature: signatureResult.signature,
        algorithm: signatureResult.algorithm,
        status: 'SIGNED',
        nextStep: 'Verify signature',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `Challenge signing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 6: Server-side signature verification
   */
  async verifySignature(sessionId, deviceIdentifier, keyId, signature) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      const challenge = session.challenge;

      // Validate and consume nonce (replay prevention)
      this.sessionManager.validateAndConsumNonce(sessionId, challenge);

      // Verify signature
      const verificationResult = this.keyManager.verifySignature(
        deviceIdentifier,
        keyId,
        challenge,
        signature
      );

      if (!verificationResult.valid) {
        const transition = await this.stateMachine.transition(
          AuthenticationEvents.VERIFY_SIGNATURE,
          { sessionId }
        );
        this.sessionManager.updateSessionState(sessionId, AuthenticationStates.SIGNATURE_INVALID);

        this.auditLogger.logSignatureVerification('INVALID', deviceIdentifier, { sessionId });
        throw new Error('Signature verification failed');
      }

      // Update state machine
      const stateTransition = await this.stateMachine.transition(
        AuthenticationEvents.VERIFY_SIGNATURE,
        { sessionId }
      );

      if (!stateTransition.success) {
        throw new Error(`Cannot complete signature verification`);
      }

      this.sessionManager.updateSessionState(sessionId, AuthenticationStates.VERIFIED);

      this.auditLogger.logSignatureVerification('VALID', deviceIdentifier, { sessionId });

      return {
        sessionId,
        verified: true,
        status: 'VERIFIED',
        nextStep: 'Connect wallet',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `Signature verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 7: Mandate wallet binding
   */
  async initiateWalletBinding(sessionId) {
    try {
      const session = this.sessionManager.getSession(sessionId);

      // Create wallet connection challenge
      const challenge = this.walletBinding.createWalletChallenge(sessionId);

      // Update state machine to WALLET_CONNECTIONS_PENDING
      const stateTransition = await this.stateMachine.transition(
        AuthenticationEvents.CONNECT_WALLET,
        { sessionId }
      );

      if (!stateTransition.success) {
        throw new Error(`Cannot initiate wallet binding in current state`);
      }

      // Update session state
      this.sessionManager.updateSessionState(
        sessionId,
        AuthenticationStates.WALLET_CONNECTIONS_PENDING
      );

      this.auditLogger.logAuthentication('WALLET_BINDING_INITIATED', sessionId);

      return {
        sessionId,
        challengeId: challenge.challengeId,
        message: challenge.message,
        expiresAt: challenge.expiresAt,
        status: 'WALLET_BINDING_PENDING',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `Wallet binding initiation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 8: Complete wallet binding
   */
  async completeWalletBinding(sessionId, walletAddress, signature, challengeId) {
    try {
      const session = this.sessionManager.getSession(sessionId);

      // Verify wallet signature
      const verification = this.walletBinding.verifyWalletSignature(
        sessionId,
        walletAddress,
        signature,
        challengeId
      );

      if (!verification.valid) {
        throw new Error('Wallet signature verification failed');
      }

      // Update state machine
      const stateTransition = await this.stateMachine.transition(
        AuthenticationEvents.CONNECT_WALLET,
        { sessionId, walletAddress }
      );

      if (!stateTransition.success) {
        throw new Error(`Cannot complete wallet binding`);
      }

      // Bind wallet to session
      this.sessionManager.bindWallet(sessionId, walletAddress);
      this.sessionManager.updateSessionState(sessionId, AuthenticationStates.WALLET_CONNECTED);

      this.auditLogger.logWalletBindingSuccess(null, walletAddress);

      return {
        sessionId,
        walletAddress,
        status: 'WALLET_CONNECTED',
        nextStep: 'Create identity',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `Wallet binding completion failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 9: Create persistent identity (final step)
   */
  async createIdentity(sessionId, deviceIdentifier) {
    try {
      const session = this.sessionManager.getSession(sessionId);

      // Extract identity-creating information from session
      const publicKey = session.publicKeyRegistered;
      const walletAddress = session.walletAddress;

      if (!publicKey || !walletAddress) {
        throw new Error('Missing required identity data');
      }

      // Create identity with DID
      const identity = this.identityService.createIdentity(
        publicKey,
        deviceIdentifier,
        walletAddress,
        {
          context: 'registration',
          sessionId,
        }
      );

      // Bind wallet to identity
      this.walletBinding.bindWalletToIdentity(identity.identityId, walletAddress, sessionId);

      // Update state machine
      const stateTransition = await this.stateMachine.transition(
        AuthenticationEvents.BIND_IDENTITY,
        { sessionId, identityId: identity.identityId }
      );

      if (!stateTransition.success) {
        throw new Error(`Cannot complete identity binding`);
      }

      this.sessionManager.updateSessionState(
        sessionId,
        AuthenticationStates.IDENTITY_BOUND,
        { identityId: identity.identityId }
      );

      // Finalize session
      this.sessionManager.finalizeSession(sessionId);

      // Issue authentication token
      const token = this._generateAuthToken(identity.identityId, sessionId);

      this.auditLogger.logIdentityCreation(identity.identityId, identity.did, deviceIdentifier);
      this.auditLogger.logAuthenticationSuccess(sessionId, identity.identityId, 'FIDO-like');

      return {
        sessionId,
        identityId: identity.identityId,
        did: identity.did,
        authToken: token,
        status: 'AUTHENTICATED',
        profile: {
          publicKey: identity.publicKey,
          walletAddress: identity.walletAddress,
          created: identity.created,
        },
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `Identity creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * ===== PRIVATE METHODS =====
   */

  _generateLPPChallengeId() {
    return `lpp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  _verifyLPPApprovalToken(token) {
    // Simulate LPP approval verification
    // In production: verify token from authenticator service
    return token && token.length > 0;
  }

  _generateAuthToken(identityId, sessionId) {
    // Simulate JWT generation
    // In production: use JWT with proper signing
    return `auth_${identityId}_${sessionId}_${Date.now()}`;
  }
}

/**
 * Login Flow
 * 
 * Streamlined login workflow for returning users:
 * 1. Session initialization with new challenge
 * 2. Local Proof of Presence verification
 * 3. Challenge signature (using existing device key)
 * 4. Server signature verification
 * 5. Wallet verification (ensure still bound)
 * 6. Access token issuance
 */

import { AuthenticationStates, AuthenticationEvents } from '../state/states.js';

export class LoginFlow {
  constructor(services) {
    this.sessionManager = services.sessionManager;
    this.stateMachine = services.stateMachine;
    this.keyManager = services.keyManager;
    this.walletBinding = services.walletBinding;
    this.identityService = services.identityService;
    this.auditLogger = services.auditLogger;
  }

  /**
   * STEP 1: Initialize login session
   * @returns { sessionId, challenge, expiresAt }
   */
  async initializeLogin(deviceMetadata = {}) {
    try {
      // Create session with new challenge
      const session = this.sessionManager.initializeSession('login', deviceMetadata);

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

      this.auditLogger.logAuthentication('LOGIN_STARTED', session.sessionId, {
        flowType: 'login',
        deviceMetadata,
      });

      return {
        sessionId: session.sessionId,
        challenge: session.challenge,
        expiresAt: session.expiresAt,
        status: 'CHALLENGE_GENERATED',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(null, `Login initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 2: Request Local Proof of Presence
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

      // Generate LPP challenge
      const lppChallengeId = this._generateLPPChallengeId();
      this.sessionManager.bindPhoneApproval(sessionId, lppChallengeId);

      this.auditLogger.logAuthentication('LPP_REQUESTED', sessionId);

      return {
        sessionId,
        lppChallengeId,
        status: 'LPP_PENDING',
        message: 'Check your authenticator app to approve this login',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `LPP request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 3: Approve Local Proof of Presence
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

      this.auditLogger.logAuthentication('LPP_APPROVED', sessionId);

      return {
        sessionId,
        status: 'LPP_VERIFIED',
        nextStep: 'Sign challenge',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `LPP approval failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 4: Sign challenge with existing device key
   * For returning users, device key should already exist
   */
  async signChallenge(sessionId, deviceIdentifier, keyId) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      const challenge = session.challenge;

      // Sign challenge using stored device private key
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
   * STEP 5: Server-side signature verification
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
        nextStep: 'Verify wallet binding',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `Signature verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 6: Verify wallet is still bound to identity
   */
  async verifyWalletBinding(sessionId, identityId, walletAddress) {
    try {
      const session = this.sessionManager.getSession(sessionId);

      // Verify wallet is bound to identity
      const binding = this.walletBinding.verifyWalletBinding(identityId, walletAddress);

      if (!binding.isBound) {
        // Wallet may have been unbound, need to re-bind
        const stateTransition = await this.stateMachine.transition(
          AuthenticationEvents.CONNECT_WALLET,
          { sessionId }
        );

        if (!stateTransition.success) {
          throw new Error(`Wallet is not bound to identity`);
        }

        this.sessionManager.updateSessionState(
          sessionId,
          AuthenticationStates.WALLET_CONNECTIONS_PENDING
        );

        return {
          sessionId,
          walletBound: false,
          status: 'WALLET_REBINDING_REQUIRED',
          message: 'Please re-connect your wallet to complete login',
        };
      }

      // Wallet is bound - update session state
      this.sessionManager.updateSessionState(
        sessionId,
        AuthenticationStates.WALLET_CONNECTED
      );

      this.sessionManager.bindWallet(sessionId, walletAddress);

      this.auditLogger.logAuthentication('WALLET_VERIFIED', sessionId, {
        identityId,
        walletAddress,
      });

      return {
        sessionId,
        walletBound: true,
        bindingId: binding.bindingId,
        status: 'WALLET_VERIFIED',
        nextStep: 'Issue token',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `Wallet verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 7: Complete wallet re-binding if necessary
   */
  async completeWalletRebinding(sessionId, walletAddress, signature, challengeId) {
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

      // Update session state
      this.sessionManager.bindWallet(sessionId, walletAddress);
      this.sessionManager.updateSessionState(sessionId, AuthenticationStates.WALLET_CONNECTED);

      this.auditLogger.logWalletBindingSuccess(session.identityId, walletAddress);

      return {
        sessionId,
        walletAddress,
        status: 'WALLET_RECONNECTED',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `Wallet rebinding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * FINAL STEP: Issue access token (complete login)
   */
  async issueAccessToken(sessionId, identityId) {
    try {
      const session = this.sessionManager.getSession(sessionId);

      // Verify identity exists and is active
      const identity = this.identityService.getIdentity(identityId);

      // Update state machine
      const stateTransition = await this.stateMachine.transition(
        AuthenticationEvents.ISSUE_TOKEN,
        { sessionId, identityId }
      );

      if (!stateTransition.success) {
        throw new Error(`Cannot issue token in current state`);
      }

      // Finalize session
      this.sessionManager.finalizeSession(sessionId);

      // Generate access token
      const token = this._generateAccessToken(identityId, sessionId);

      // Also generate optional wallet signature context
      const context = {
        identityId,
        did: identity.did,
        walletAddress: session.walletAddress,
      };

      this.auditLogger.logAuthenticationSuccess(sessionId, identityId, 'FIDO-like');

      return {
        sessionId,
        identityId,
        did: identity.did,
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn: 3600, // 1 hour
        context,
        status: 'AUTHENTICATED',
      };
    } catch (error) {
      this.auditLogger.logAuthenticationFailure(sessionId, `Token issuance failed: ${error.message}`);
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
    return token && token.length > 0;
  }

  _generateAccessToken(identityId, sessionId) {
    // Simulate JWT generation
    // In production: use JWT with proper signing + expiration
    return `access_${identityId}_${sessionId}_${Date.now()}`;
  }
}

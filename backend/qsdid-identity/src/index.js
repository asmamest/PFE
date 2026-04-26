/**
 * QSDID Authentication System - Main Orchestrator
 * 
 * Initializes and coordinates all authentication services
 * Provides unified API for authentication flows
 */

import { AuthenticationStateMachine } from './state/stateMachine.js';
import { AuthenticationStates } from './state/states.js';
import { SessionManagementService } from './services/sessionManagement.js';
import { KeyManagementService } from './services/keyManagement.js';
import { WalletBindingService } from './services/walletBinding.js';
import { IdentityService } from './services/identityService.js';
import { AuditLoggingService } from './services/auditLogging.js';
import { PostQuantumCryptoService } from './services/postQuantumCryptoService.js';
import { LocalProofOfPresenceService } from './services/localProofOfPresenceService.js';
import { RegistrationFlow } from './flows/registrationFlow.js';
import { LoginFlow } from './flows/loginFlow.js';

export class QSDIDAuthenticationSystem {
  constructor(options = {}) {
    this.logger = options.logger || console;

    // Initialize all services
    this.stateMachine = new AuthenticationStateMachine();
    this.sessionManager = new SessionManagementService(options.sessionConfig || {});
    this.keyManager = new KeyManagementService(options.keyConfig || {});
    this.walletBinding = new WalletBindingService(options.walletConfig || {});
    this.identityService = new IdentityService(options.identityConfig || {});
    this.auditLogger = new AuditLoggingService(options.auditConfig || {});
    
    // New services: Post-Quantum Cryptography & Local Proof of Presence
    this.pqcService = new PostQuantumCryptoService(options.pqcConfig || {});
    this.lppService = new LocalProofOfPresenceService(options.lppConfig || {});

    // Initialize flows
    const flowServices = {
      sessionManager: this.sessionManager,
      stateMachine: this.stateMachine,
      keyManager: this.keyManager,
      walletBinding: this.walletBinding,
      identityService: this.identityService,
      auditLogger: this.auditLogger,
      pqcService: this.pqcService,
      lppService: this.lppService,
    };

    this.registrationFlow = new RegistrationFlow(flowServices);
    this.loginFlow = new LoginFlow(flowServices);

    // Setup background jobs
    this._setupBackgroundJobs(options.backgroundJobsConfig || {});

    this.logger.info('[QSDID Auth System] Initialized successfully');
  }

  /**
   * ===== PUBLIC API =====
   */

  /**
   * Start registration process
   */
  getRegistrationFlow() {
    return this.registrationFlow;
  }

  /**
   * Start login process
   */
  getLoginFlow() {
    return this.loginFlow;
  }

  /**
   * Get authentication status
   */
  getAuthenticationStatus(sessionId) {
    try {
      const session = this.sessionManager.getSession(sessionId);
      return {
        sessionId,
        status: session.currentState,
        createdAt: session.timestamp,
        expiresAt: session.expiresAt,
        flowType: session.flowType,
      };
    } catch (error) {
      return {
        sessionId,
        status: 'ERROR',
        error: error.message,
      };
    }
  }

  /**
   * Verify identity is authenticated
   */
  verifyIdentity(identityId) {
    try {
      const identity = this.identityService.getIdentity(identityId);
      return {
        valid: true,
        identityId,
        did: identity.did,
        status: identity.status,
        verificationStatus: identity.verificationStatus,
      };
    } catch (error) {
      return {
        valid: false,
        identityId,
        error: error.message,
      };
    }
  }

  /**
   * Get audit logs for session
   */
  getSessionAuditLog(sessionId) {
    return this.auditLogger.getSessionLogs(sessionId);
  }

  /**
   * Get audit logs for identity
   */
  getIdentityAuditLog(identityId) {
    return this.auditLogger.getIdentityLogs(identityId);
  }

  /**
   * Get security incidents (last N hours)
   */
  getSecurityIncidents(hours = 24) {
    return this.auditLogger.getSecurityIncidents(hours);
  }

  /**
   * Get system metrics
   */
  getSystemMetrics() {
    return {
      sessions: this.sessionManager.getMetrics(),
      identities: this.identityService.listIdentities(),
      auditLogs: {
        total: this.auditLogger.logs.length,
        recentEvents: this.auditLogger.queryLogs({ limit: 10 }),
      },
      stateTransitions: this.stateMachine.getTransitionHistory(),
    };
  }

  /**
   * Revoke identity (admin operation)
   */
  revokeIdentity(identityId, reason = 'Administrative revocation') {
    try {
      const result = this.identityService.revokeIdentity(identityId, reason);
      this.auditLogger.logIdentityRevocation(identityId, reason);
      return result;
    } catch (error) {
      this.logger.error(`Failed to revoke identity ${identityId}:`, error);
      throw error;
    }
  }

  /**
   * Revoke session (admin operation)
   */
  revokeSession(sessionId, reason = 'Administrative revocation') {
    try {
      const result = this.sessionManager.revokeSession(sessionId, reason);
      this.auditLogger.logAuthentication('SESSION_REVOKED', sessionId, { reason });
      return result;
    } catch (error) {
      this.logger.error(`Failed to revoke session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Export identity DID document
   */
  exportDIDDocument(identityId) {
    return this.identityService.exportDIDDocument(identityId);
  }

  /**
   * ===== INTERNAL METHODS =====
   */

  /**
   * Setup background jobs for maintenance
   * @private
   */
  _setupBackgroundJobs(config) {
    const cleanupInterval = config.cleanupInterval || 5 * 60 * 1000; // 5 minutes

    setInterval(() => {
      try {
        // Cleanup expired sessions
        const sessionCleanup = this.sessionManager.cleanupExpiredSessions();
        
        // Cleanup expired nonces
        const walletCleanup = this.walletBinding.cleanupExpiredChallenges();
        
        // Cleanup old logs
        const logCleanup = this.auditLogger.cleanupOldLogs();

        if (sessionCleanup.cleanedSessions > 0 || logCleanup.removed > 0) {
          this.logger.info('[Background Job] Cleanup completed', {
            sessions: sessionCleanup.cleanedSessions,
            logs: logCleanup.removed,
          });
        }
      } catch (error) {
        this.logger.error('[Background Job] Cleanup failed:', error);
      }
    }, cleanupInterval);
  }

  /**
   * Health check
   */
  getHealthStatus() {
    return {
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      components: {
        sessionManager: this.sessionManager ? 'OK' : 'FAILED',
        keyManager: this.keyManager ? 'OK' : 'FAILED',
        walletBinding: this.walletBinding ? 'OK' : 'FAILED',
        identityService: this.identityService ? 'OK' : 'FAILED',
        auditLogger: this.auditLogger ? 'OK' : 'FAILED',
        stateMachine: this.stateMachine ? 'OK' : 'FAILED',
      },
      metrics: {
        sessions: this.sessionManager.getMetrics().activeSessions,
        identities: this.identityService.listIdentities().length,
      },
    };
  }

  /**
   * Reset state machine for new authentication session
   * In production, each session would have its own state machine
   * This method prepares the system for a new authentication flow
   */
  reinitializeStateMachine() {
    this.stateMachine = new AuthenticationStateMachine();
    
    // Update flows with the new state machine
    const flowServices = {
      sessionManager: this.sessionManager,
      stateMachine: this.stateMachine,
      keyManager: this.keyManager,
      walletBinding: this.walletBinding,
      identityService: this.identityService,
      auditLogger: this.auditLogger,
    };

    this.registrationFlow = new RegistrationFlow(flowServices);
    this.loginFlow = new LoginFlow(flowServices);
    
    return this.stateMachine;
  }
}

/**
 * Export all public types and utilities
 */
export { 
  AuthenticationStates,
  AuthenticationStateMachine,
  SessionManagementService,
  KeyManagementService,
  WalletBindingService,
  IdentityService,
  AuditLoggingService,
  RegistrationFlow,
  LoginFlow,
};

export { SecurityUtils, ValidationError } from './utils/securityUtils.js';

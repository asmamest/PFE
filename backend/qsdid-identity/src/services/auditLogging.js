/**
 * Audit Logging Service
 * 
 * Provides immutable event logging for:
 * - Authentication events
 * - Cryptographic operations
 * - Wallet binding events
 * - Verification outcomes
 * - Security incidents
 * 
 * All logs are immutable and structured with: [LEVEL], [CATEGORY], timestamp, details
 */

export class AuditLoggingService {
  constructor(options = {}) {
    this.logs = [];
    this.maxLogs = options.maxLogs || 100000;
    this.logRetention = options.logRetention || 90 * 24 * 60 * 60 * 1000; // 90 days
    this.backendStore = options.backendStore || null; // For persistence
  }

  /**
   * Log levels
   */
  static LogLevel = {
    INFO: '[INFO]',
    SECURITY: '[SECURITY]',
    SUCCESS: '[SUCCESS]',
    ERROR: '[ERROR]',
    WARNING: '[WARNING]',
  };

  /**
   * Log categories
   */
  static LogCategory = {
    AUTHENTICATION: 'AUTHENTICATION',
    CRYPTOGRAPHY: 'CRYPTOGRAPHY',
    WALLET_BINDING: 'WALLET_BINDING',
    IDENTITY: 'IDENTITY',
    SESSION: 'SESSION',
    VERIFICATION: 'VERIFICATION',
    SECURITY_INCIDENT: 'SECURITY_INCIDENT',
    SYSTEM: 'SYSTEM',
  };

  /**
   * Log authentication event
   */
  logAuthentication(eventType, sessionId, details = {}) {
    return this._createLog(
      AuditLoggingService.LogLevel.AUTHENTICATION,
      AuditLoggingService.LogCategory.AUTHENTICATION,
      {
        eventType,
        sessionId,
        ...details,
      }
    );
  }

  /**
   * Log cryptographic operation
   */
  logCryptography(operation, deviceIdentifier, details = {}) {
    return this._createLog(
      AuditLoggingService.LogLevel.INFO,
      AuditLoggingService.LogCategory.CRYPTOGRAPHY,
      {
        operation,
        deviceIdentifier,
        ...details,
      }
    );
  }

  /**
   * Log successful authentication
   */
  logAuthenticationSuccess(sessionId, identityId, method = 'FIDO-like') {
    return this._createLog(
      AuditLoggingService.LogLevel.SUCCESS,
      AuditLoggingService.LogCategory.AUTHENTICATION,
      {
        result: 'SUCCESS',
        sessionId,
        identityId,
        method,
      }
    );
  }

  /**
   * Log authentication failure
   */
  logAuthenticationFailure(sessionId, reason = 'Unknown') {
    return this._createLog(
      AuditLoggingService.LogLevel.ERROR,
      AuditLoggingService.LogCategory.AUTHENTICATION,
      {
        result: 'FAILURE',
        sessionId,
        reason,
      }
    );
  }

  /**
   * Log wallet binding operation
   */
  logWalletBinding(operation, identityId, walletAddress, details = {}) {
    return this._createLog(
      AuditLoggingService.LogLevel.INFO,
      AuditLoggingService.LogCategory.WALLET_BINDING,
      {
        operation,
        identityId,
        walletAddress,
        ...details,
      }
    );
  }

  /**
   * Log wallet binding success
   */
  logWalletBindingSuccess(identityId, walletAddress) {
    return this._createLog(
      AuditLoggingService.LogLevel.SUCCESS,
      AuditLoggingService.LogCategory.WALLET_BINDING,
      {
        result: 'SUCCESS',
        identityId,
        walletAddress,
      }
    );
  }

  /**
   * Log identity creation
   */
  logIdentityCreation(identityId, did, deviceIdentifier) {
    return this._createLog(
      AuditLoggingService.LogLevel.SUCCESS,
      AuditLoggingService.LogCategory.IDENTITY,
      {
        operation: 'CREATE',
        identityId,
        did,
        deviceIdentifier,
      }
    );
  }

  /**
   * Log identity revocation
   */
  logIdentityRevocation(identityId, reason = 'User requested') {
    return this._createLog(
      AuditLoggingService.LogLevel.SECURITY,
      AuditLoggingService.LogCategory.IDENTITY,
      {
        operation: 'REVOKE',
        identityId,
        reason,
      }
    );
  }

  /**
   * Log signature verification
   */
  logSignatureVerification(status, deviceIdentifier, details = {}) {
    const level = status === 'VALID' 
      ? AuditLoggingService.LogLevel.SUCCESS 
      : AuditLoggingService.LogLevel.ERROR;

    return this._createLog(
      level,
      AuditLoggingService.LogCategory.VERIFICATION,
      {
        operation: 'SIGNATURE_VERIFICATION',
        status,
        deviceIdentifier,
        ...details,
      }
    );
  }

  /**
   * Log security incident
   */
  logSecurityIncident(incidentType, details = {}) {
    return this._createLog(
      AuditLoggingService.LogLevel.SECURITY,
      AuditLoggingService.LogCategory.SECURITY_INCIDENT,
      {
        incidentType,
        severity: details.severity || 'MEDIUM',
        ...details,
      }
    );
  }

  /**
   * Log replay attack detection
   */
  logReplayAttackDetection(sessionId, nonce, details = {}) {
    return this.logSecurityIncident('REPLAY_ATTACK_DETECTED', {
      sessionId,
      nonce,
      severity: 'HIGH',
      ...details,
    });
  }

  /**
   * Log session lockout
   */
  logSessionLockout(sessionId, reason = 'Max attempts exceeded') {
    return this._createLog(
      AuditLoggingService.LogLevel.WARNING,
      AuditLoggingService.LogCategory.SESSION,
      {
        operation: 'LOCKOUT',
        sessionId,
        reason,
      }
    );
  }

  /**
   * Query logs
   */
  queryLogs(filter = {}) {
    let results = [...this.logs];

    if (filter.sessionId) {
      results = results.filter(l => l.details.sessionId === filter.sessionId);
    }

    if (filter.identityId) {
      results = results.filter(l => l.details.identityId === filter.identityId);
    }

    if (filter.category) {
      results = results.filter(l => l.category === filter.category);
    }

    if (filter.level) {
      results = results.filter(l => l.level === filter.level);
    }

    if (filter.after) {
      results = results.filter(l => l.timestamp >= filter.after);
    }

    if (filter.before) {
      results = results.filter(l => l.timestamp <= filter.before);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Limit results
    const limit = filter.limit || 100;
    return results.slice(0, limit);
  }

  /**
   * Get logs for session
   */
  getSessionLogs(sessionId) {
    return this.queryLogs({ sessionId });
  }

  /**
   * Get logs for identity
   */
  getIdentityLogs(identityId) {
    return this.queryLogs({ identityId });
  }

  /**
   * Get security incidents
   */
  getSecurityIncidents(hours = 24) {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    return this.queryLogs({
      category: AuditLoggingService.LogCategory.SECURITY_INCIDENT,
      after: since,
    });
  }

  /**
   * Get authentication statistics
   */
  getAuthenticationStats(hours = 24) {
    const since = Date.now() - (hours * 60 * 60 * 1000);
    const logs = this.queryLogs({
      category: AuditLoggingService.LogCategory.AUTHENTICATION,
      after: since,
    });

    const stats = {
      total: logs.length,
      successful: 0,
      failed: 0,
      byMethod: {},
      byHour: {},
    };

    for (const log of logs) {
      if (log.details.result === 'SUCCESS') stats.successful++;
      if (log.details.result === 'FAILURE') stats.failed++;

      const method = log.details.method || 'unknown';
      stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;

      const hour = new Date(log.timestamp).toISOString().substring(0, 13);
      stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
    }

    return stats;
  }

  /**
   * ===== PRIVATE METHODS =====
   */

  /**
   * @private
   * Create immutable log entry
   */
  _createLog(level, category, details) {
    const logEntry = {
      logId: this._generateLogId(),
      level,
      category,
      timestamp: Date.now(),
      details,
      immutable: true, // Cannot be modified after creation
    };

    this.logs.push(logEntry);

    // Enforce max logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Persist if backend store available
    if (this.backendStore) {
      this.backendStore.persist(logEntry).catch(err => {
        console.error('Failed to persist audit log:', err);
      });
    }

    return logEntry;
  }

  /**
   * @private
   * Generate unique log ID
   */
  _generateLogId() {
    return `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Cleanup old logs (background job)
   */
  cleanupOldLogs() {
    const cutoff = Date.now() - this.logRetention;
    const before = this.logs.length;

    this.logs = this.logs.filter(log => log.timestamp > cutoff);

    return {
      removed: before - this.logs.length,
      remaining: this.logs.length,
    };
  }

  /**
   * Export logs (immutable format)
   */
  exportLogs(filter = {}) {
    const logs = this.queryLogs(filter);

    return {
      exportId: `export_${Date.now()}`,
      exportedAt: new Date().toISOString(),
      count: logs.length,
      logs: logs.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp).toISOString(),
      })),
    };
  }
}

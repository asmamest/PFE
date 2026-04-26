// src/provider/circuitBreaker.js
// Redis circuit breaker with exponential backoff and health check.
// States: CLOSED (ok) → OPEN (failures) → HALF_OPEN (testing recovery)

import { logger } from '../utils/logger.js';

const CIRCUIT_BREAKER_STATES = {
  CLOSED: 0,      // Normal operation
  OPEN: 1,        // Too many failures, reject requests
  HALF_OPEN: 2,   // Testing if service recovered
};

class CircuitBreaker {
  constructor({
    name = 'redis',
    failureThreshold = 3,           // Failures before OPEN
    successThreshold = 2,           // Successes in HALF_OPEN before CLOSED
    timeout = 30000,                // ms before HALF_OPEN → CLOSED attempt
    backoffMultiplier = 2,
  } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeout = timeout;
    this.backoffMultiplier = backoffMultiplier;

    this.state = CIRCUIT_BREAKER_STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Get current state as number (0=closed, 1=open, 2=half-open)
   */
  getState() {
    return this.state;
  }

  /**
   * Get state as string for logging
   */
  getStateString() {
    const stateMap = { 0: 'CLOSED', 1: 'OPEN', 2: 'HALF_OPEN' };
    return stateMap[this.state] || 'UNKNOWN';
  }

  /**
   * Record a successful operation
   */
  recordSuccess() {
    if (this.state === CIRCUIT_BREAKER_STATES.CLOSED) {
      this.failureCount = 0;
      return;
    }

    if (this.state === CIRCUIT_BREAKER_STATES.HALF_OPEN) {
      this.successCount += 1;
      logger.info(
        `[CircuitBreaker:${this.name}] HALF_OPEN success (${this.successCount}/${this.successThreshold})`
      );

      if (this.successCount >= this.successThreshold) {
        this.state = CIRCUIT_BREAKER_STATES.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        logger.info(`[CircuitBreaker:${this.name}] ✓ CLOSED — service recovered`);
      }
    }
  }

  /**
   * Record a failed operation
   */
  recordFailure() {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.state === CIRCUIT_BREAKER_STATES.CLOSED) {
      logger.warn(
        `[CircuitBreaker:${this.name}] Failure (${this.failureCount}/${this.failureThreshold})`
      );

      if (this.failureCount >= this.failureThreshold) {
        this.state = CIRCUIT_BREAKER_STATES.OPEN;
        this.nextAttemptTime = Date.now() + this.timeout;
        logger.error(
          `[CircuitBreaker:${this.name}] ✗ OPEN — circuit broken, retry after ${this.timeout}ms`
        );
      }
    } else if (this.state === CIRCUIT_BREAKER_STATES.HALF_OPEN) {
      // Failure in HALF_OPEN goes back to OPEN
      this.state = CIRCUIT_BREAKER_STATES.OPEN;
      this.successCount = 0;
      this.nextAttemptTime = Date.now() + this.timeout;
      logger.error(`[CircuitBreaker:${this.name}] ✗ Back to OPEN after HALF_OPEN failure`);
    }
  }

  /**
   * Check if request should be allowed through circuit
   * @returns {boolean} true if allowed, false if circuit is open
   */
  isAllowed() {
    if (this.state === CIRCUIT_BREAKER_STATES.CLOSED) {
      return true;
    }

    if (this.state === CIRCUIT_BREAKER_STATES.OPEN) {
      // Try to transition to HALF_OPEN if timeout has elapsed
      if (Date.now() >= this.nextAttemptTime) {
        this.state = CIRCUIT_BREAKER_STATES.HALF_OPEN;
        this.successCount = 0;
        logger.info(`[CircuitBreaker:${this.name}] → HALF_OPEN (testing recovery)`);
        return true; // Allow this one attempt
      }
      return false;
    }

    if (this.state === CIRCUIT_BREAKER_STATES.HALF_OPEN) {
      return true; // Allow attempts in HALF_OPEN
    }

    return false;
  }

  /**
   * Reset to CLOSED state (for tests)
   */
  reset() {
    this.state = CIRCUIT_BREAKER_STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    logger.info(`[CircuitBreaker:${this.name}] Reset to CLOSED`);
  }

  /**
   * Get detailed status for monitoring
   */
  getStatus() {
    return {
      name: this.name,
      state: this.getStateString(),
      stateCode: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }
}

export { CircuitBreaker, CIRCUIT_BREAKER_STATES };

// tests/unit/circuitBreaker.test.js
// Test: Circuit breaker - 3 failures → OPEN → fallback response

import { CircuitBreaker, CIRCUIT_BREAKER_STATES } from '../../src/provider/circuitBreaker.js';

describe('Circuit Breaker', () => {
  let breaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-redis',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000, // Short timeout for testing
    });
  });

  test('should start in CLOSED state', () => {
    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.CLOSED);
    expect(breaker.isAllowed()).toBe(true);
  });

  test('should transition to OPEN after 3 failures', () => {
    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.CLOSED);

    breaker.recordFailure(); // 1
    expect(breaker.isAllowed()).toBe(true);

    breaker.recordFailure(); // 2
    expect(breaker.isAllowed()).toBe(true);

    breaker.recordFailure(); // 3 - should OPEN
    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.OPEN);
    expect(breaker.isAllowed()).toBe(false);
  });

  test('should reject requests when OPEN', () => {
    // Open the circuit
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.OPEN);

    // All attempts should be rejected
    for (let i = 0; i < 5; i++) {
      expect(breaker.isAllowed()).toBe(false);
    }
  });

  test('should transition to HALF_OPEN after timeout', async () => {
    // Open the circuit
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.OPEN);

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Should be allowed to try
    expect(breaker.isAllowed()).toBe(true);
    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.HALF_OPEN);
  });

  test('should close after 2 successes in HALF_OPEN state', () => {
    // Get to HALF_OPEN
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess(); // Transition to HALF_OPEN already happens on first check

    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.HALF_OPEN);

    breaker.recordSuccess(); // 1st success in HALF_OPEN
    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.HALF_OPEN);

    breaker.recordSuccess(); // 2nd success → CLOSE
    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.CLOSED);
    expect(breaker.isAllowed()).toBe(true);
  });

  test('should reopen if failure occurs in HALF_OPEN', () => {
    // Get to HALF_OPEN
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess(); // Triggers transition to HALF_OPEN

    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.HALF_OPEN);

    // Failure in HALF_OPEN should go back to OPEN
    breaker.recordFailure();
    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.OPEN);
    expect(breaker.isAllowed()).toBe(false);
  });

  test('should reset to CLOSED state', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.OPEN);

    breaker.reset();

    expect(breaker.getState()).toBe(CIRCUIT_BREAKER_STATES.CLOSED);
    expect(breaker.isAllowed()).toBe(true);
  });

  test('should provide detailed status', () => {
    breaker.recordFailure();
    const status = breaker.getStatus();

    expect(status).toHaveProperty('name', 'test-redis');
    expect(status).toHaveProperty('state');
    expect(status).toHaveProperty('stateCode');
    expect(status).toHaveProperty('failureCount', 1);
    expect(status).toHaveProperty('successCount', 0);
  });
});

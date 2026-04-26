/**
 * Event-Driven State Machine Engine
 * 
 * Enforces deterministic state transitions with dependency injection
 * for logging, validation, and side effects
 */

import { AuthenticationStates, StateTransitions, AuthenticationEvents } from './states.js';

export class AuthenticationStateMachine {
  constructor(initialState = AuthenticationStates.INIT) {
    this.currentState = initialState;
    this.previousState = null;
    this.transitionHistory = [];
    this.eventHandlers = new Map();
    this.validators = new Map();
    this.middleware = [];
  }

  /**
   * Register custom event handler
   */
  onEvent(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  /**
   * Register state transition validator
   */
  registerValidator(fromState, toState, validator) {
    const key = `${fromState}→${toState}`;
    this.validators.set(key, validator);
  }

  /**
   * Add middleware (runs before all transitions)
   */
  use(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Execute transition with full audit trail
   * @returns { success: boolean, previousState, newState, event, timestamp, error? }
   */
  async transition(eventType, payload = {}, context = {}) {
    const transitionAttempt = {
      timestamp: new Date(),
      event: eventType,
      fromState: this.currentState,
      payload,
      context,
      metadata: {},
    };

    try {
      // Run middleware
      for (const mw of this.middleware) {
        await mw(transitionAttempt, this.currentState);
      }

      // Determine next state
      const allowedTransitions = StateTransitions[this.currentState] || [];
      let nextState = this._computeNextState(eventType, allowedTransitions);

      if (!nextState) {
        const error = new InvalidTransitionError(
          `Cannot transition from ${this.currentState} on event ${eventType}`,
          this.currentState,
          null,
          eventType
        );
        transitionAttempt.error = error;
        await this._notifyHandlers('TRANSITION_REJECTED', transitionAttempt);
        return {
          success: false,
          previousState: this.currentState,
          newState: null,
          event: eventType,
          timestamp: transitionAttempt.timestamp,
          error: error.message,
        };
      }

      // Run validators
      const validationKey = `${this.currentState}→${nextState}`;
      if (this.validators.has(validationKey)) {
        const validator = this.validators.get(validationKey);
        const validation = await validator(payload, context);
        if (!validation.valid) {
          const error = new TransitionValidationError(
            validation.reason,
            this.currentState,
            nextState
          );
          transitionAttempt.error = error;
          await this._notifyHandlers('VALIDATION_FAILED', transitionAttempt);
          return {
            success: false,
            previousState: this.currentState,
            newState: null,
            event: eventType,
            timestamp: transitionAttempt.timestamp,
            error: error.message,
          };
        }
      }

      // Execute transition
      this.previousState = this.currentState;
      this.currentState = nextState;
      transitionAttempt.toState = nextState;

      // Record history
      this.transitionHistory.push({
        from: this.previousState,
        to: nextState,
        event: eventType,
        timestamp: transitionAttempt.timestamp,
        context,
      });

      // Notify handlers
      await this._notifyHandlers('TRANSITION_SUCCESS', transitionAttempt);

      return {
        success: true,
        previousState: this.previousState,
        newState: nextState,
        event: eventType,
        timestamp: transitionAttempt.timestamp,
      };
    } catch (error) {
      transitionAttempt.error = error;
      await this._notifyHandlers('TRANSITION_ERROR', transitionAttempt);
      return {
        success: false,
        previousState: this.currentState,
        newState: null,
        event: eventType,
        timestamp: transitionAttempt.timestamp,
        error: error.message,
      };
    }
  }

  /**
   * Compute next state based on event
   * @private
   */
  _computeNextState(eventType, allowedTransitions) {
    // Map event to potential next states
    const eventToStateMap = {
      [AuthenticationEvents.INITIALIZE]: [AuthenticationStates.CHALLENGE_GENERATED],
      [AuthenticationEvents.CHALLENGE_CREATED]: [AuthenticationStates.LPP_PENDING],
      [AuthenticationEvents.REQUEST_LPP]: [AuthenticationStates.LPP_PENDING],
      [AuthenticationEvents.LPP_APPROVED]: [AuthenticationStates.LPP_VERIFIED],
      [AuthenticationEvents.LPP_DENIED]: [AuthenticationStates.LPP_REJECTED],
      [AuthenticationEvents.GENERATE_KEYS]: [AuthenticationStates.KEY_GENERATED],
      [AuthenticationEvents.SIGN_CHALLENGE]: [AuthenticationStates.SIGNED],
      [AuthenticationEvents.VERIFY_SIGNATURE]: [AuthenticationStates.VERIFIED],
      [AuthenticationEvents.CONNECT_WALLET]: [AuthenticationStates.WALLET_CONNECTIONS_PENDING, AuthenticationStates.WALLET_CONNECTED],
      [AuthenticationEvents.BIND_IDENTITY]: [AuthenticationStates.IDENTITY_BOUND],
      [AuthenticationEvents.ISSUE_TOKEN]: [AuthenticationStates.AUTHENTICATED],
      [AuthenticationEvents.SESSION_EXPIRED]: [AuthenticationStates.EXPIRED],
      [AuthenticationEvents.REPLAY_ATTACK_DETECTED]: [AuthenticationStates.REPLAY_DETECTED],
    };

    const candidates = eventToStateMap[eventType] || [];
    return candidates.find(state => allowedTransitions.includes(state));
  }

  /**
   * Notify all handlers for an event
   * @private
   */
  async _notifyHandlers(eventType, data) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      for (const handler of handlers) {
        try {
          await handler(data);
        } catch (error) {
          console.error(`Handler error for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Query state machine
   */
  canTransitionTo(eventType) {
    const allowed = StateTransitions[this.currentState] || [];
    return allowed.length > 0;
  }

  getTransitionHistory() {
    return this.transitionHistory;
  }

  getCurrentState() {
    return this.currentState;
  }

  getPreviousState() {
    return this.previousState;
  }
}

/**
 * Custom errors for state machine
 */
class InvalidTransitionError extends Error {
  constructor(message, fromState, toState, event) {
    super(message);
    this.name = 'InvalidTransitionError';
    this.fromState = fromState;
    this.toState = toState;
    this.event = event;
  }
}

class TransitionValidationError extends Error {
  constructor(message, fromState, toState) {
    super(`Validation failed: ${message}`);
    this.name = 'TransitionValidationError';
    this.fromState = fromState;
    this.toState = toState;
  }
}

export { InvalidTransitionError, TransitionValidationError };

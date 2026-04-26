// src/lib/qsdid/stateMachine.ts
/**
 * Strict event-driven auth state machine.
 * No automatic progression — every transition needs an explicit event.
 */
import { useCallback, useMemo, useReducer } from "react";

export type AuthState =
  | "INIT"
  | "TOTP_SETUP"
  | "TOTP_VERIFIED"
  | "BACKEND_READY"
  | "KEYS_GENERATED"
  | "CHALLENGE_REQUESTED"
  | "CHALLENGE_RECEIVED"
  | "SIGNED"
  | "VERIFIED"
  | "WALLET_CONNECTED"
  | "PASSKEY_READY"        // ← À ajouter
  | "AUTHENTICATED";

export type AuthEvent =
  | "TOTP_SETUP_STARTED"
  | "TOTP_VERIFIED"
  | "BACKEND_OK"
  | "KEYS_GENERATED"
  | "CHALLENGE_REQUESTED"
  | "CHALLENGE_RECEIVED"
  | "SIGNED"
  | "VERIFIED"
  | "WALLET_CONNECTED"      // événement pour passer de VERIFIED → WALLET_CONNECTED
  | "WALLET_DONE"           // ← événement pour passer de WALLET_CONNECTED → PASSKEY_READY
  | "PASSKEY_DONE"          // ← événement pour passer de PASSKEY_READY → AUTHENTICATED
  | "ACCESS_GRANTED"
  | "RESET";

const transitions: Record<AuthState, Partial<Record<AuthEvent, AuthState>>> = {
  INIT: { TOTP_SETUP_STARTED: "TOTP_SETUP", RESET: "INIT" },
  TOTP_SETUP: { TOTP_VERIFIED: "TOTP_VERIFIED", RESET: "INIT" },
  TOTP_VERIFIED: { BACKEND_OK: "BACKEND_READY", RESET: "INIT" },
  BACKEND_READY: { KEYS_GENERATED: "KEYS_GENERATED", RESET: "INIT" },
  KEYS_GENERATED: { CHALLENGE_REQUESTED: "CHALLENGE_REQUESTED", RESET: "INIT" },
  CHALLENGE_REQUESTED: { CHALLENGE_RECEIVED: "CHALLENGE_RECEIVED", RESET: "INIT" },
  CHALLENGE_RECEIVED: { SIGNED: "SIGNED", RESET: "INIT" },
  SIGNED: { VERIFIED: "VERIFIED", RESET: "INIT" },
  VERIFIED: {
    WALLET_CONNECTED: "WALLET_CONNECTED",   // après signature
    RESET: "INIT"
  },
  WALLET_CONNECTED: {
    WALLET_DONE: "PASSKEY_READY",           // après connexion wallet
    RESET: "INIT"
  },
  PASSKEY_READY: {
    PASSKEY_DONE: "AUTHENTICATED",          // après création passkey
    RESET: "INIT"
  },
  AUTHENTICATED: { RESET: "INIT" },
};

function reducer(state: AuthState, event: AuthEvent): AuthState {
  const next = transitions[state]?.[event];
  if (!next) {
    console.warn(`[STATE] Illegal transition ${state} → ${event} (ignored)`);
    return state;
  }
  return next;
}

export function useAuthMachine(initial: AuthState = "INIT") {
  const [state, dispatch] = useReducer(reducer, initial);
  const send = useCallback((evt: AuthEvent) => dispatch(evt), []);
  return useMemo(() => ({ state, send }), [state, send]);
}
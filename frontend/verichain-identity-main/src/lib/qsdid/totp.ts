// src/lib/qsdid/totp.ts
import * as OTPAuth from "otpauth";

const ISSUER = "QS·DID";
const SS_KEY_PREFIX = "qsdid.totp.";

/** Build a fresh TOTP secret + otpauth:// URI compatible with Google Authenticator. */
export function createTotp(label: string): { secret: string; uri: string; totp: OTPAuth.TOTP } {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
  return { secret: secret.base32, uri: totp.toString(), totp };
}

/** Validate a 6-digit code against a stored base32 secret. */
export function verifyTotp(secretBase32: string, code: string, label = "user"): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  // window=1 ⇒ accept previous/next 30s slot to handle clock drift
  const delta = totp.validate({ token: code.replace(/\s+/g, ""), window: 1 });
  return delta !== null;
}

/** DEV ONLY: persist TOTP secret in sessionStorage keyed by identity reference. */
export function persistTotpDev(ref: string, secret: string) {
  sessionStorage.setItem(SS_KEY_PREFIX + ref, secret);
}

export function loadTotpDev(ref: string): string | null {
  return sessionStorage.getItem(SS_KEY_PREFIX + ref);
}

export function clearTotpDev(ref: string) {
  sessionStorage.removeItem(SS_KEY_PREFIX + ref);
}
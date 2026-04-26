// src/lib/qsdid/audit.ts
/* Console audit logger for the auth pipeline. Never logs secrets. */
type Level = "INFO" | "SUCCESS" | "WARN" | "ERROR";

const styles: Record<Level, string> = {
  INFO: "color:#60a5fa;font-weight:600",
  SUCCESS: "color:#22c55e;font-weight:600",
  WARN: "color:#f59e0b;font-weight:600",
  ERROR: "color:#ef4444;font-weight:600",
};

export type AuditEvent = {
  level: Level;
  message: string;
  ts: number;
  meta?: Record<string, unknown>;
};

const buffer: AuditEvent[] = [];
const listeners = new Set<(e: AuditEvent) => void>();

export function audit(level: Level, message: string, meta?: Record<string, unknown>) {
  // Désactiver les logs en production
  if (!import.meta.env.DEV) return;

  const evt: AuditEvent = { level, message, ts: Date.now(), meta };
  buffer.push(evt);
  if (buffer.length > 500) buffer.shift();
  console.log(`%c[${level}]%c ${message}`, styles[level], "color:inherit", meta ?? "");
  listeners.forEach((l) => l(evt));
}

export function subscribeAudit(fn: (e: AuditEvent) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAuditLog(): readonly AuditEvent[] {
  return buffer;
}
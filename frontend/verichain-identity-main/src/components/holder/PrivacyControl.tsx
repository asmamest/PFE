// src/components/holder/PrivacyControl.tsx
import { useState } from "react";
import { ShieldCheck, Trash2, Clock, ArrowRight, ToggleLeft, ToggleRight, Eye, RefreshCw, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  verifier: string;
  scope: string;
  expiresIn: string;
}

const mockSessions: Session[] = [
  { id: "s1", verifier: "verifier.eu",   scope: "University Diploma",  expiresIn: "2 hours"   },
  { id: "s2", verifier: "acmecorp.com",  scope: "Employment Proof",    expiresIn: "1 day"     },
  { id: "s3", verifier: "lufthansa.com", scope: "Age Proof (ZKP)",     expiresIn: "30 minutes"},
];

interface Toggle {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const toggleDefs: Toggle[] = [
  { id: "zkp",        label: "Selective disclosure (ZKP)", description: "Share only required attributes",     icon: ShieldCheck },
  { id: "autoexpiry", label: "Auto-expiry on shares",      description: "Revoke access after 24 h by default", icon: RefreshCw   },
  { id: "notify",     label: "Notify on every access",     description: "Receive alerts on credential reads",  icon: Bell        },
];

export function PrivacyControl() {
  const [sessions, setSessions] = useState<Session[]>(mockSessions);
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    zkp: true,
    autoexpiry: false,
    notify: true,
  });

  const revoke = (id: string) => setSessions((prev) => prev.filter((s) => s.id !== id));
  const toggle = (id: string) => setToggles((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Privacy Control</h2>
        <p className="text-xs text-muted-foreground">Manage who sees your data</p>
      </div>

      <div className="flex items-center justify-center gap-3 py-4 px-6 rounded-xl bg-secondary/30 border border-border/50 text-sm">
        <div className="flex flex-col items-center gap-1">
          <div className="size-9 rounded-full bg-primary/15 grid place-items-center">
            <Eye className="size-4 text-primary" />
          </div>
          <span className="text-[11px] font-medium text-foreground">You</span>
        </div>
        <ArrowRight className="size-4 text-muted-foreground/50 shrink-0" />
        <div className="flex gap-2 flex-wrap justify-center">
          {sessions.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-1">
              <div className="size-9 rounded-full bg-accent/10 border border-accent/20 grid place-items-center text-[10px] font-bold text-accent uppercase">
                {s.verifier.charAt(0)}
              </div>
              <span className="text-[9px] text-muted-foreground max-w-[56px] truncate text-center">{s.verifier}</span>
            </div>
          ))}
          {sessions.length === 0 && (
            <span className="text-xs text-muted-foreground italic">No active verifiers</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Active Sessions</h3>
        {sessions.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">No active sessions.</p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-border/60 bg-card/50 group hover:border-destructive/25 transition-all duration-200"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-lg bg-primary/10 grid place-items-center shrink-0 text-[10px] font-bold text-primary uppercase">
                {s.verifier.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{s.verifier}</div>
                <div className="text-[11px] text-muted-foreground truncate">Scope: {s.scope}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="size-3" />
                {s.expiresIn}
              </div>
              <button
                onClick={() => revoke(s.id)}
                className="size-7 grid place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Revoke access"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Privacy Settings</h3>
        {toggleDefs.map((t) => {
          const Icon = t.icon;
          const on = toggles[t.id];
          return (
            <div
              key={t.id}
              className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-border/60 bg-card/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn("size-8 rounded-lg grid place-items-center shrink-0", on ? "bg-primary/10" : "bg-secondary/50")}>
                  <Icon className={cn("size-4", on ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">{t.label}</div>
                  <div className="text-[11px] text-muted-foreground">{t.description}</div>
                </div>
              </div>
              <button onClick={() => toggle(t.id)} className="shrink-0">
                {on ? (
                  <ToggleRight className="size-7 text-primary" />
                ) : (
                  <ToggleLeft className="size-7 text-muted-foreground" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

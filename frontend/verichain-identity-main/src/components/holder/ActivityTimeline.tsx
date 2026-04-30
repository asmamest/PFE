// src/components/holder/ActivityTimeline.tsx
import { CheckCircle2, AlertTriangle, Share2, ShieldOff, Eye, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type EventKind = "success" | "info" | "alert";

interface TimelineEvent {
  kind: EventKind;
  icon: React.ElementType;
  title: string;
  detail: string;
  time: string;
}

const events: TimelineEvent[] = [
  { kind: "success", icon: Share2,        title: "Credential shared",            detail: "University Diploma → verifier.eu",        time: "2 min ago"   },
  { kind: "info",    icon: CheckCircle2,  title: "Verification request approved", detail: "Acme Corp · Employment proof",           time: "1 hour ago"  },
  { kind: "info",    icon: Eye,           title: "ZKP proof verified",            detail: "Age proof → lufthansa.com",              time: "3 hours ago" },
  { kind: "alert",   icon: AlertTriangle, title: "Unusual access attempt",        detail: "Unknown verifier · blocked",             time: "5 hours ago" },
  { kind: "info",    icon: ShieldOff,     title: "Access revoked",                detail: "Old session · device cleanup",           time: "Yesterday"   },
  { kind: "info",    icon: Info,          title: "DID Document updated",          detail: "Key rotation completed on-chain",        time: "3 days ago"  },
];

const palette: Record<EventKind, { dot: string; icon: string; ring: string }> = {
  success: { dot: "bg-green-500",  icon: "text-green-500",  ring: "ring-green-500/20"  },
  info:    { dot: "bg-blue-500",   icon: "text-blue-500",   ring: "ring-blue-500/20"   },
  alert:   { dot: "bg-red-500",    icon: "text-red-500",    ring: "ring-red-500/20"    },
};

export function ActivityTimeline() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Activity Timeline</h2>
        <p className="text-xs text-muted-foreground">Every event, fully auditable</p>
      </div>

      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/30 via-border to-transparent" />

        <div className="space-y-3">
          {events.map((e, i) => {
            const Icon = e.icon;
            const p = palette[e.kind];
            return (
              <div key={i} className="relative group">
                {/* Dot */}
                <div
                  className={cn(
                    "absolute -left-[19px] top-3.5 size-2.5 rounded-full ring-4 ring-background",
                    p.dot
                  )}
                >
                  <span className={cn("absolute inset-0 rounded-full animate-ping opacity-30", p.dot)} />
                </div>

                <div className="bg-secondary/30 rounded-xl p-3.5 border border-border/60 transition-all duration-200 group-hover:translate-x-1 group-hover:border-primary/25 group-hover:bg-secondary/50">
                  <div className="flex items-start gap-3">
                    <Icon className={cn("size-4 mt-0.5 shrink-0", p.icon)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-sm text-foreground">{e.title}</span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{e.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{e.detail}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
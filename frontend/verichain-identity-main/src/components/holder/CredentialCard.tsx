// src/components/holder/CredentialCard.tsx
import { Lock, Share2, Eye, Settings2, CheckCircle2, XCircle, AlertCircle, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type CredentialStatus = "active" | "expired" | "revoked" | "pending";

export interface CredentialData {
  id: string;
  name: string;
  issuer: string;
  status: CredentialStatus;
  type?: string;
  sensitivity?: number;
  issuedAt?: string;
  icon?: LucideIcon;
}

const statusConfig: Record<
  CredentialStatus,
  { icon: LucideIcon; color: string; bg: string; label: string }
> = {
  active:  { icon: CheckCircle2, color: "text-green-500",  bg: "bg-green-500/10 border-green-500/25",  label: "Active"  },
  expired: { icon: XCircle,      color: "text-amber-500",  bg: "bg-amber-500/10 border-amber-500/25",  label: "Expired" },
  revoked: { icon: AlertCircle,  color: "text-red-500",    bg: "bg-red-500/10 border-red-500/25",      label: "Revoked" },
  pending: { icon: AlertCircle,  color: "text-blue-400",   bg: "bg-blue-400/10 border-blue-400/25",    label: "Pending" },
};

interface CredentialCardProps {
  credential: CredentialData;
  onShare?: (id: string) => void;
  onView?: (id: string) => void;
  onManage?: (id: string) => void;
}

export function CredentialCard({ credential, onShare, onView, onManage }: CredentialCardProps) {
  const { id, name, issuer, status, sensitivity = 2, icon: Icon } = credential;
  const st = statusConfig[status] ?? statusConfig.active;
  const StatusIcon = st.icon;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm p-4 transition-all duration-300 hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5 hover:border-primary/25">
      <div className="pointer-events-none absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full" />

      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
            {Icon ? (
              <Icon className="size-5 text-primary" />
            ) : (
              <span className="text-primary font-bold text-xs">{name.charAt(0)}</span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: Math.min(sensitivity, 3) }).map((_, k) => (
              <Lock key={k} className="size-2.5 text-muted-foreground/50" />
            ))}
          </div>
        </div>

        <div>
          <div className="font-semibold text-sm text-foreground leading-tight">{name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Issued by {issuer}</div>
          {credential.issuedAt && (
            <div className="text-[10px] text-muted-foreground/70 mt-0.5">{credential.issuedAt}</div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-medium",
              st.bg,
              st.color
            )}
          >
            <StatusIcon className="size-2.5" />
            {st.label}
          </span>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
            <button
              onClick={() => onShare?.(id)}
              title="Share credential"
              className="size-7 grid place-items-center rounded-lg bg-secondary hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Share2 className="size-3.5" />
            </button>
            <button
              onClick={() => onView?.(id)}
              title="View details"
              className="size-7 grid place-items-center rounded-lg bg-secondary hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Eye className="size-3.5" />
            </button>
            <button
              onClick={() => onManage?.(id)}
              title="Manage access"
              className="size-7 grid place-items-center rounded-lg bg-secondary hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Settings2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

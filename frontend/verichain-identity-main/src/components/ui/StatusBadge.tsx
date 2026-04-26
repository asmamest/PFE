import { CheckCircle2, Clock, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "active" | "pending" | "revoked" | "expired";

const config: Record<Status, { label: string; icon: typeof CheckCircle2; className: string }> = {
  active: { label: "Active", icon: CheckCircle2, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending: { label: "Pending", icon: Clock, className: "bg-amber-50 text-amber-700 border-amber-200" },
  revoked: { label: "Revoked", icon: XCircle, className: "bg-red-50 text-red-700 border-red-200" },
  expired: { label: "Expired", icon: AlertTriangle, className: "bg-amber-50 text-amber-700 border-amber-200" },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, icon: Icon, className: statusClass } = config[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", statusClass, className)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
  subtext?: string;
  delay?: number;
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-primary bg-primary/10",
  success: "text-success bg-success/10",
  warning: "text-warning bg-warning/10",
  destructive: "text-destructive bg-destructive/10",
};

export function StatCard({ label, value, icon: Icon, tone = "default", subtext, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-foreground tabular-nums">{value}</p>
          {subtext && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">{subtext}</p>
          )}
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  );
}
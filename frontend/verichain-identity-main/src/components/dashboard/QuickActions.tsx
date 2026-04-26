// components/dashboard/quick-actions.tsx
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export type QuickActionConfig = {
  icon: LucideIcon;
  label: string;
  href: string;
};

interface QuickActionsProps {
  actions: QuickActionConfig[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="border border-border/60 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.label}
            to={action.href}
            className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-background transition-colors">
              <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-sm font-medium">{action.label}</p>
              <p className="text-xs text-muted-foreground">Go →</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

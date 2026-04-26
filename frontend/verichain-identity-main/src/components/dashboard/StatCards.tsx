// components/dashboard/stat-cards.tsx
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export type StatCardConfig = {
  label: string;
  value: number;
  icon: LucideIcon;
  subtext: string;
  subColor: string;
};

interface StatCardsProps {
  configs: StatCardConfig[];
  baseDelay?: number;
}

export function StatCards({ configs, baseDelay = 120 }: StatCardsProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {configs.map((card, index) => {
        const Icon = card.icon;
        const delay = (baseDelay + index * 50) / 1000;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut", delay }}
            className="bg-muted/40 rounded-xl p-4 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{card.label}</span>
              <Icon className="w-4 h-4 text-muted-foreground/60" />
            </div>
            <span className="text-2xl font-semibold tabular-nums">{card.value}</span>
            <span className={`text-xs ${card.subColor}`}>{card.subtext}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

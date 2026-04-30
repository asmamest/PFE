// src/components/holder/StatCards.tsx
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export interface StatCardConfig {
  label: string;
  value: number;
  icon: LucideIcon;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

interface StatCardsProps {
  stats: StatCardConfig[];
  delayStep?: number;
}

export function StatCards({ stats, delayStep = 50 }: StatCardsProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        const delay = (idx * delayStep) / 1000;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut", delay }}
            className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm p-4 hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-1.5 text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
                {stat.subtext && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{stat.subtext}</p>
                )}
                {stat.trend && stat.trendValue && (
                  <p className={`mt-0.5 text-[10px] font-medium ${
                    stat.trend === 'up' ? 'text-green-500' : stat.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                  }`}>
                    {stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '→'} {stat.trendValue}
                  </p>
                )}
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
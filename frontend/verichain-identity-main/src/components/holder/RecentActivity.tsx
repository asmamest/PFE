// src/components/holder/RecentActivity.tsx
import { CheckCircle2, AlertTriangle, Share2, ShieldOff, Eye, Info } from "lucide-react";

export interface ActivityEvent {
  type: 'success' | 'info' | 'alert';
  icon?: React.ElementType;
  title: string;
  description: string;
  time: string;
}

const defaultIcons = {
  success: CheckCircle2,
  info: Info,
  alert: AlertTriangle,
};

export function RecentActivity({ events }: { events: ActivityEvent[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
      </div>
      <div className="divide-y divide-border/40">
        {events.map((event, idx) => {
          const Icon = event.icon || defaultIcons[event.type];
          const colorClass = event.type === 'success' ? 'text-green-500' : event.type === 'alert' ? 'text-red-500' : 'text-blue-500';
          return (
            <div key={idx} className="flex gap-3 px-5 py-3">
              <Icon className={`h-4 w-4 mt-0.5 ${colorClass}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{event.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{event.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
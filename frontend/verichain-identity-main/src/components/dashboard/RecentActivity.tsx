// components/dashboard/recent-activity.tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ActivityEvent, ActivityEventType } from "@/lib/mock-data";

const EVENT_COLORS: Record<ActivityEventType, string> = {
  credential_received: "#639922",
  zkp_sent: "#378ADD",
  verification_valid: "#7F77DD",
  request_submitted: "#BA7517",
  request_rejected: "#E24B4A",
  wallet_connected: "#888780",
  credential_expiring: "#BA7517",
  presentation_sent: "#378ADD",
};

interface RecentActivityProps {
  events: ActivityEvent[];
}

export function RecentActivity({ events }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader className="py-4 px-5">
        <span className="text-sm font-medium">Recent activity</span>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        {events.map((event, i) => (
          <div key={i} className="flex gap-2.5 py-2.5 border-b border-border/50 last:border-0">
            <div
              className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
              style={{ background: EVENT_COLORS[event.type] }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-snug">{event.description}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{event.timestamp}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

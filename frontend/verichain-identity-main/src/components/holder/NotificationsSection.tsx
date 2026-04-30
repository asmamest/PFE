// src/components/holder/NotificationsSection.tsx
import { useState } from "react";
import { CheckCircle2, AlertTriangle, Share2, ShieldOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  type: "credential_received" | "verification_request" | "status_change";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

const mockNotifs: Notification[] = [
  { id: "1", type: "credential_received", title: "New credential received", description: "Master's Degree from Université Paris-Saclay", timestamp: "2 hours ago", read: false },
  { id: "2", type: "verification_request", title: "Verification request", description: "A verifier checked your National ID Card", timestamp: "5 hours ago", read: false },
  { id: "3", type: "status_change", title: "Credential updated", description: "Employment Certificate status changed to Active", timestamp: "1 day ago", read: true },
];

const iconMap = {
  credential_received: CheckCircle2,
  verification_request: Eye,
  status_change: Share2,
};

export function NotificationsSection() {
  const [notifs, setNotifs] = useState(mockNotifs);
  const unreadCount = notifs.filter(n => !n.read).length;

  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Notifications</h2>
          <p className="text-xs text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</p>
        </div>
        {unreadCount > 0 && <Button variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Button>}
      </div>

      <div className="space-y-2">
        {notifs.map(n => {
          const Icon = iconMap[n.type];
          return (
            <div key={n.id} className={`rounded-xl border border-border/60 bg-card/50 p-4 ${!n.read ? "border-primary/30 bg-primary/5" : ""}`}>
              <div className="flex gap-3">
                <Icon className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{n.timestamp}</p>
                </div>
                {!n.read && <span className="h-2 w-2 rounded-full bg-primary mt-1" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
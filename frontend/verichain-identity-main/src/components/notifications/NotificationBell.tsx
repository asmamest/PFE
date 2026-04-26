// components/notifications/notification-bell.tsx
import { useState } from "react";
import { Bell, FileCheck, Clock, AlertTriangle, ShieldCheck, ShieldX, CheckCircle2, XCircle, Fingerprint, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/lib/mock-data";
import { useReducedMotion } from "framer-motion";

const NOTIFICATION_ICONS: Record<NotificationType, { icon: typeof Bell; className: string }> = {
  credential_received: { icon: FileCheck, className: "text-green-600" },
  credential_pending: { icon: Clock, className: "text-amber-500" },
  credential_expiring: { icon: AlertTriangle, className: "text-amber-500" },
  verification_valid: { icon: ShieldCheck, className: "text-green-600" },
  verification_invalid: { icon: ShieldX, className: "text-red-500" },
  request_accepted: { icon: CheckCircle2, className: "text-green-600" },
  request_rejected: { icon: XCircle, className: "text-red-500" },
  zkp_sent: { icon: Fingerprint, className: "text-blue-600" },
  presentation_received: { icon: QrCode, className: "text-blue-600" },
};

interface NotificationBellProps {
  notifications: Notification[];
}

export function NotificationBell({ notifications }: NotificationBellProps) {
  const [items, setItems] = useState(notifications);
  const shouldReduceMotion = useReducedMotion();
  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-2 w-2">
              {!shouldReduceMotion && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              )}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            {items.map((notification) => {
              const { icon: TypeIcon, className: iconClass } = NOTIFICATION_ICONS[notification.type];
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer",
                    !notification.read && "bg-blue-50/50 dark:bg-blue-950/20"
                  )}
                >
                  {!notification.read ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  ) : (
                    <span className="w-1.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug">{notification.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{notification.timeAgo}</p>
                  </div>
                  <TypeIcon className={cn("w-3.5 h-3.5 flex-shrink-0 mt-0.5", iconClass)} />
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border/60 px-4 py-2">
          <button className="text-xs text-muted-foreground hover:text-primary transition-colors">
            View all →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

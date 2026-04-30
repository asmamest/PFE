// src/components/holder/NotificationBell.tsx
import { useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

export function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const [items, setItems] = useState(notifications);
  const unreadCount = items.filter(n => !n.read).length;

  const markAllRead = () => {
    setItems(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-primary">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
          )}
          {items.map((notif) => (
            <div key={notif.id} className={cn("flex flex-col gap-1 px-4 py-3 border-b border-border/40 hover:bg-secondary/20 transition-colors", !notif.read && "bg-primary/5")}>
              <div className="flex justify-between">
                <p className="text-sm font-medium text-foreground">{notif.title}</p>
                {!notif.read && <span className="h-2 w-2 rounded-full bg-primary" />}
              </div>
              <p className="text-xs text-muted-foreground">{notif.description}</p>
              <p className="text-[10px] text-muted-foreground">{notif.time}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-border/60 px-4 py-2">
          <button className="text-xs text-muted-foreground hover:text-primary">View all →</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
// src/components/holder/HolderSidebar.tsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  IdCard,
  Send,
  Upload,
  Bell,
  User,
  Sparkles,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/holder",             label: "Overview",    icon: LayoutDashboard },
  { to: "/holder/credentials", label: "Credentials", icon: IdCard },
  { to: "/holder/request",     label: "Request",     icon: Send },
  { to: "/holder/upload",      label: "Upload",      icon: Upload },
  { to: "/holder/notifications",label: "Notifications", icon: Bell },
  { to: "/holder/profile",     label: "Profile",     icon: User },
];

interface HolderSidebarProps {
  did?: string;
  onDisconnect?: () => void;
}

export function HolderSidebar({ did, onDisconnect }: HolderSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const truncatedDid = did
    ? `${did.slice(0, 16)}...${did.slice(-6)}`
    : "did:zk:0x···";

  const handleDisconnect = () => {
    if (onDisconnect) onDisconnect();
    navigate("/login");
  };

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-card/60 backdrop-blur-xl border-r border-border/60 h-screen sticky top-0">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-border/40">
        <div className="size-9 rounded-xl bg-gradient-to-br from-primary via-primary/80 to-accent grid place-items-center shadow-lg shadow-primary/20">
          <Sparkles className="size-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-foreground font-mono">QS·DID</div>
          <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Holder Portal</div>
        </div>
      </div>

      <nav className="px-3 py-4 flex-1 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active =
            item.to === "/holder"
              ? location.pathname === "/holder"
              : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-primary" />
              )}
              <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "group-hover:text-foreground")} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="size-3 text-primary/50" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-border/40 space-y-2">
        <div className="bg-secondary/40 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest text-green-600 font-semibold">Active</span>
          </div>
          <code className="text-[11px] font-mono text-muted-foreground break-all leading-tight block">
            {truncatedDid}
          </code>
        </div>
        <button
          onClick={handleDisconnect}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        >
          <LogOut className="size-4" />
          <span className="font-medium">Disconnect</span>
        </button>
      </div>
    </aside>
  );
}
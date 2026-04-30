import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Inbox,
  BadgeCheck,
  Activity,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export type SectionKey = "overview" | "requests" | "credentials" | "transactions";

const items: { key: SectionKey; label: string; icon: typeof LayoutDashboard; targetId: string }[] = [
  { key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard, targetId: "overview" },
  { key: "requests", label: "Demandes", icon: Inbox, targetId: "requests" },
  { key: "credentials", label: "Mes credentials", icon: BadgeCheck, targetId: "credentials" },
  { key: "transactions", label: "Transactions", icon: Activity, targetId: "transactions" },
];

interface Props {
  onLogout: () => void;
  pendingCount?: number;
}

export function DashboardSidebar({ onLogout, pendingCount = 0 }: Props) {
  const [active, setActive] = useState<SectionKey>("overview");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id as SectionKey);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    items.forEach((it) => {
      const el = document.getElementById(it.targetId);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleNav = (id: string, key: SectionKey) => {
    setActive(key);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 border-r border-border bg-card/40 backdrop-blur-sm transition-all duration-300 lg:flex lg:flex-col ${
        collapsed ? "w-14" : "w-64"
      }`}
    >
      {/* Header sidebar - seulement le bouton quand collapsed */}
      <div className={`flex items-center border-b border-border transition-all duration-300 ${
        collapsed ? "justify-center h-14 px-2" : "justify-between h-14 px-4"
      }`}>
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 shadow-sm">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-foreground">QS·DID</p>
              <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                Issuer Console
              </p>
            </div>
          </div>
        )}
        
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors ${
            collapsed ? "mx-auto" : ""
          }`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Navigation - cachée complètement quand collapsed */}
      {!collapsed && (
        <nav className="flex-1 space-y-1 p-2">
          <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Navigation
          </p>
          {items.map((it) => {
            const isActive = active === it.key;
            const showBadge = it.key === "requests" && pendingCount > 0;
            return (
              <button
                key={it.key}
                onClick={() => handleNav(it.targetId, it.key)}
                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <it.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left text-xs">{it.label}</span>
                {showBadge && (
                  <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* Icônes compactes quand collapsed */}
      {collapsed && (
        <nav className="flex-1 space-y-1 p-2">
          {items.map((it) => {
            const isActive = active === it.key;
            const showBadge = it.key === "requests" && pendingCount > 0;
            return (
              <button
                key={it.key}
                onClick={() => handleNav(it.targetId, it.key)}
                title={it.label}
                className={`group relative flex w-full items-center justify-center rounded-lg py-3 transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <it.icon className="h-5 w-5 shrink-0" />
                {showBadge && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </button>
            );
          })}
        </nav>
      )}

      {/* Footer logout - adapté */}
      <div className={`border-t border-border ${collapsed ? "p-2" : "p-2"}`}>
        <button
          onClick={onLogout}
          title={collapsed ? "Déconnexion" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive ${
            collapsed ? "justify-center py-3" : "px-3 py-2"
          }`}
        >
          <LogOut className={`${collapsed ? "h-5 w-5" : "h-4 w-4"} shrink-0`} />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
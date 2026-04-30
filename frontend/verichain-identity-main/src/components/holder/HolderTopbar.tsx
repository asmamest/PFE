// src/components/holder/HolderTopbar.tsx
import { Bell, Search, Menu } from "lucide-react";
import { useState } from "react";

interface HolderTopbarProps {
  name?: string;
  onSearch?: (query: string) => void;
}

export function HolderTopbar({ name, onSearch }: HolderTopbarProps) {
  const [notifications] = useState(3);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-0.5">{today}</div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Welcome back,{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {name || "Holder"}
          </span>
        </h1>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <div className="hidden md:flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2 w-64 border border-border/50 focus-within:border-primary/40 focus-within:bg-background transition-all duration-200">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            placeholder="Search credentials…"
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground min-w-0"
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>

        <button className="relative size-10 grid place-items-center bg-secondary/50 rounded-xl hover:bg-secondary transition-colors border border-border/50">
          <Bell className="size-4" />
          {notifications > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] font-bold text-white grid place-items-center px-0.5 ring-2 ring-background">
              {notifications}
            </span>
          )}
        </button>

        <button className="lg:hidden size-10 grid place-items-center bg-secondary/50 rounded-xl border border-border/50">
          <Menu className="size-4" />
        </button>
      </div>
    </header>
  );
}

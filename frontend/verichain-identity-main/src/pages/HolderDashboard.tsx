// pages/HolderDashboard.tsx
import { motion, useReducedMotion } from "framer-motion";
import { FileCheck, Clock, Share2, Fingerprint, Plus } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { DIDBar } from "@/components/identity/DIDBar";
import { StatCards, type StatCardConfig } from "@/components/dashboard/StatCards";
import { RecentCredentials } from "@/components/dashboard/RecentCredentials";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActions, type QuickActionConfig } from "@/components/dashboard/QuickActions";
import { mockNotifications, mockHolder } from "@/lib/mock-data";

const MOCK_WALLET = "0x4a9c3f2b1e8d7a06c5f4e3b2a1908d7c6f5e4b3a";

export default function HolderDashboard() {
  const shouldReduceMotion = useReducedMotion();

  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, ease: "easeOut" as const, delay: delay / 1000 },
  });

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const holderStats: StatCardConfig[] = [
    { label: "Active credentials", value: mockHolder.stats.activeCredentials, icon: FileCheck, subtext: "+1 this week", subColor: "text-green-600" },
    { label: "Pending requests", value: mockHolder.stats.pendingRequests, icon: Clock, subtext: "Awaiting issuer", subColor: "text-amber-500" },
    { label: "Presentations sent", value: mockHolder.stats.presentationsSent, icon: Share2, subtext: `${mockHolder.stats.presentationsVerified} verified`, subColor: "text-muted-foreground" },
    { label: "ZKP proofs", value: mockHolder.stats.zkpGenerated, icon: Fingerprint, subtext: mockHolder.stats.zkpFailed === 0 ? "All valid" : `${mockHolder.stats.zkpFailed} failed`, subColor: mockHolder.stats.zkpFailed === 0 ? "text-green-600" : "text-red-500" },
  ];

  const holderActions: QuickActionConfig[] = [
    { icon: Plus, label: "Request a credential", href: "/holder/request" },
    { icon: Share2, label: "Create a presentation", href: "/holder/present" },
    { icon: Fingerprint, label: "Generate ZKP", href: "/holder/zkp" },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar walletAddress={MOCK_WALLET} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 backdrop-blur-lg px-4">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border" />
            <span className="text-sm font-medium text-muted-foreground">Holder Dashboard</span>
          </header>

          <main className="flex-1 overflow-y-auto flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
            {/* Bloc 1 — Top bar */}
            <motion.div {...fadeUp(0)} className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">Overview</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Welcome back, {mockHolder.name} — {formattedDate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell notifications={mockNotifications} />
              </div>
            </motion.div>

            {/* Bloc 2 — DID bar */}
            <motion.div {...fadeUp(60)}>
              <DIDBar did={mockHolder.did} chain="ZKsync Atlas L2" />
            </motion.div>

            {/* Bloc 3 — Stat cards */}
            <StatCards configs={holderStats} baseDelay={120} />

            {/* Bloc 4 — Two columns */}
            <motion.div {...fadeUp(250)} className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
              <RecentCredentials credentials={mockHolder.credentials} viewAllHref="/holder/credentials" />
              <RecentActivity events={mockHolder.activity} />
            </motion.div>

            {/* Bloc 5 — Quick actions */}
            <motion.div {...fadeUp(320)}>
              <QuickActions actions={holderActions} />
            </motion.div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// pages/VerifierDashboard.tsx
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, CheckCircle2, XCircle, Clock, QrCode, Search } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { DIDBar } from "@/components/identity/DIDBar";
import { StatCards, type StatCardConfig } from "@/components/dashboard/StatCards";
import { RecentCredentials } from "@/components/dashboard/RecentCredentials";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { QuickActions, type QuickActionConfig } from "@/components/dashboard/QuickActions";
import { mockNotifications, mockVerifier } from "@/lib/mock-data";

const MOCK_WALLET = "0x1c4e2d8f6a3b7c9e0d5f1a2b8c4d6e7f3a9b2c5e";

export default function VerifierDashboard() {
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

  const verifierStats: StatCardConfig[] = [
    { label: "Verifications done", value: mockVerifier.stats.total, icon: ShieldCheck, subtext: "All time", subColor: "text-muted-foreground" },
    { label: "VALID results", value: mockVerifier.stats.valid, icon: CheckCircle2, subtext: "Confirmed", subColor: "text-green-600" },
    { label: "INVALID results", value: mockVerifier.stats.invalid, icon: XCircle, subtext: "Flagged", subColor: "text-red-500" },
    { label: "Pending", value: mockVerifier.stats.pending, icon: Clock, subtext: "In progress", subColor: "text-amber-500" },
  ];

  const verifierActions: QuickActionConfig[] = [
    { icon: ShieldCheck, label: "Start verification", href: "/verifier/verify" },
    { icon: QrCode, label: "Scan QR", href: "/verifier/scan" },
    { icon: Search, label: "View history", href: "/verifier/history" },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar walletAddress={MOCK_WALLET} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 backdrop-blur-lg px-4">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border" />
            <span className="text-sm font-medium text-muted-foreground">Verifier Dashboard</span>
          </header>

          <main className="flex-1 overflow-y-auto flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
            <motion.div {...fadeUp(0)} className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">Overview</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Welcome back, {mockVerifier.name} — {formattedDate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell notifications={mockNotifications} />
              </div>
            </motion.div>

            <motion.div {...fadeUp(60)}>
              <DIDBar did={mockVerifier.did} chain="ZKsync Atlas L2" />
            </motion.div>

            <StatCards configs={verifierStats} baseDelay={120} />

            <motion.div {...fadeUp(250)} className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
              <RecentCredentials credentials={mockVerifier.credentials} viewAllHref="/verifier/history" />
              <RecentActivity events={mockVerifier.activity} />
            </motion.div>

            <motion.div {...fadeUp(320)}>
              <QuickActions actions={verifierActions} />
            </motion.div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

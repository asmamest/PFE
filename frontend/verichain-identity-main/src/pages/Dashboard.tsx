import { Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { ProfileSection } from "@/components/dashboard/ProfileSection";
import { MyCredentialsSection } from "@/components/dashboard/MyCredentialsSection";
import { RequestCredentialSection } from "@/components/dashboard/RequestCredentialSection";
import { UploadDocumentSection } from "@/components/dashboard/UploadDocumentSection";
import { NotificationsSection } from "@/components/dashboard/NotificationsSection";

// In production, wallet address comes from auth context / onboarding
const MOCK_WALLET = "0x7a3B4c9D2e1F8a6C5b0D3E7f9A2c4B6d8E1f3A5C";

export default function Dashboard() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DashboardSidebar walletAddress={MOCK_WALLET} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur-lg px-4">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border" />
            <span className="text-sm font-medium text-muted-foreground">Holder Dashboard</span>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 max-w-5xl">
            <Routes>
              <Route index element={<ProfileSection walletAddress={MOCK_WALLET} />} />
              <Route path="credentials" element={<MyCredentialsSection />} />
              <Route path="request" element={<RequestCredentialSection />} />
              <Route path="upload" element={<UploadDocumentSection />} />
              <Route path="notifications" element={<NotificationsSection />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

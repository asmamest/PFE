import { SidebarProvider } from "@/components/ui/sidebar";
import { HolderSidebar } from "@/components/holder/HolderSidebar";
import { HolderTopbar } from "@/components/holder/HolderTopbar";
import { MyCredentialsSection } from "@/components/holder/MyCredentialsSection";

export default function HolderCredentials() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <HolderSidebar />
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6">
          <HolderTopbar />
          <MyCredentialsSection />
        </main>
      </div>
    </SidebarProvider>
  );
}
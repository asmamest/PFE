import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { HolderSidebar } from "@/components/holder/HolderSidebar";
import { HolderTopbar } from "@/components/holder/HolderTopbar";
import { ProfileSection } from "@/components/holder/ProfileSection";

// Récupérer l'identité depuis sessionStorage ou un hook
function useIdentity() {
  const [identity, setIdentity] = useState<any>(null);
  useEffect(() => {
    const stored = sessionStorage.getItem("qsdid.identity");
    if (stored) {
      setIdentity(JSON.parse(stored));
    } else {
      // fallback mock pour le développement
      setIdentity({
        did: "did:zk:0xE5B98b16163Fbf805aAF0f9d6089abf22044212f",
        walletAddress: "0xE5B98b16163Fbf805aAF0f9d6089abf22044212f",
        publicKey: "mock-public-key",
      });
    }
  }, []);
  return identity;
}

export default function HolderProfile() {
  const identity = useIdentity();

  if (!identity) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <HolderSidebar />
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6">
          <HolderTopbar />
          <ProfileSection
            walletAddress={identity.walletAddress}
            did={identity.did}
            publicKey={identity.publicKey}
          />
        </main>
      </div>
    </SidebarProvider>
  );
}
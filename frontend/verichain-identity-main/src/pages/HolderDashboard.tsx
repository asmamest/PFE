// src/pages/HolderDashboard.tsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { fetchHolderCredentials, type Credential } from "@/lib/holder/credentialService";
import { SidebarProvider } from "@/components/ui/sidebar";
import { HolderSidebar } from "@/components/holder/HolderSidebar";
import { HolderTopbar } from "@/components/holder/HolderTopbar";
import { IdentityHero } from "@/components/holder/IdentityHero";
import { StatCards, type StatCardConfig } from "@/components/holder/StatCards";
import { MyCredentialsSection } from "@/components/holder/MyCredentialsSection";
import { ActivityTimeline } from "@/components/holder/ActivityTimeline";
import { QuickActions } from "@/components/holder/QuickActions";
import { Shield, Clock, Share2, Fingerprint } from "lucide-react";
import { USER_REGISTRY_ADDRESS } from "@/lib/blockchain/constants";
import userRegistryAbi from "@/lib/blockchain/UserRegistryAbi.json";
import { fetchFromIPFS } from "@/lib/ipfs/ipfsClient"; // ✅ import du fallback resilient

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface Identity {
  did: string;
  walletAddress: string;
  createdAt: number;
  publicKey?: string;
  fullName: string;
}

export default function HolderDashboard() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);

  // Chargement de l'identité réelle depuis la blockchain et IPFS (avec fallback)
  useEffect(() => {
    const loadRealIdentity = async () => {
      setLoading(true);
      try {
        if (!window.ethereum) {
          console.error("MetaMask not installed");
          setLoading(false);
          return;
        }

        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        let addr = accounts?.[0];
        if (!addr) {
          const newAccounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          addr = newAccounts?.[0];
        }
        if (!addr) {
          setLoading(false);
          return;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, userRegistryAbi, provider);
        const user = await contract.getUser(addr);

        if (!user || !user.active) {
          console.warn("No active holder found for this wallet");
          setLoading(false);
          return;
        }

        const cid = user.metadataCID;
        if (!cid) throw new Error("No metadata CID found");

        // ✅ Lecture IPFS résiliente (multi‑gateway)
        const profile = await fetchFromIPFS(cid);

        const fullName = profile.fullName || "Holder";
        const did = `did:zk:${addr}`;
        const publicKey = profile.publicKeyMultibase || "";

        setIdentity({
          did,
          walletAddress: addr,
          createdAt: Number(user.registeredAt) * 1000,
          publicKey,
          fullName,
        });
      } catch (err) {
        console.error("loadRealIdentity error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadRealIdentity();
  }, []);

  // Chargement des credentials (déjà corrigé dans credentialService.ts)
  useEffect(() => {
    if (identity?.walletAddress) {
      setCredentialsLoading(true);
      fetchHolderCredentials(identity.walletAddress)
        .then(setCredentials)
        .catch(console.error)
        .finally(() => setCredentialsLoading(false));
    }
  }, [identity]);

  const stats = useMemo(() => {
    const active = credentials.filter(c => c.status === "active").length;
    const expired = credentials.filter(c => c.status === "expired").length;
    const revoked = credentials.filter(c => c.status === "revoked").length;
    const total = credentials.length;
    return { active, expired, revoked, total };
  }, [credentials]);

  const statCards: StatCardConfig[] = [
    { label: "Active credentials", value: stats.active, icon: Shield, subtext: "Active", trend: "up", trendValue: `/${stats.total}` },
    { label: "Expired", value: stats.expired, icon: Clock, subtext: "Renew soon", trend: "down", trendValue: "" },
    { label: "Presentations sent", value: 0, icon: Share2, subtext: "Coming soon", trend: "neutral", trendValue: "—" },
    { label: "ZKP proofs", value: 0, icon: Fingerprint, subtext: "Coming soon", trend: "neutral", trendValue: "—" },
  ];

  if (loading || credentialsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Aucune identité trouvée</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vous devez d'abord vous enregistrer en tant que holder.
          </p>
          <button onClick={() => navigate("/onboarding")} className="mt-4 text-primary underline">
            Aller à l'enregistrement
          </button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <HolderSidebar did={identity.did} />
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6">
          <HolderTopbar name={identity.fullName} />
          <div className="space-y-8">
            <IdentityHero
              did={identity.did}
              walletAddress={identity.walletAddress}
              createdAt={identity.createdAt}
            />
            <StatCards stats={statCards} />
            <MyCredentialsSection credentials={credentials} loading={credentialsLoading} />
            <ActivityTimeline />
          </div>
        </main>
        <QuickActions />
      </div>
    </SidebarProvider>
  );
}
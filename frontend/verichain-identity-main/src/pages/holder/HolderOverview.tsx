// src/pages/holder/HolderOverview.tsx
import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { fetchHolderCredentials, type Credential } from "@/lib/holder/credentialService";
import { IdentityHero } from "@/components/holder/IdentityHero";
import { StatCards, type StatCardConfig } from "@/components/holder/StatCards";
import { MyCredentialsSection } from "@/components/holder/MyCredentialsSection";
import { ActivityTimeline } from "@/components/holder/ActivityTimeline";
import { Shield, Clock, Share2, Fingerprint } from "lucide-react";
import { RequestCredentialSection } from "@/components/holder/RequestCredentialSection";

interface Identity {
  did: string;
  walletAddress: string;
  fullName: string;
  createdAt: number;
  publicKey?: string;
}

export function HolderOverview() {
  const { identity } = useOutletContext<{ identity: Identity }>();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (identity?.walletAddress) {
      fetchHolderCredentials(identity.walletAddress)
        .then(setCredentials)
        .catch(console.error)
        .finally(() => setLoading(false));
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

  return (
    <div className="space-y-8">
      <IdentityHero
        did={identity.did}
        walletAddress={identity.walletAddress}
        createdAt={identity.createdAt}
      />
      <StatCards stats={statCards} />
      <MyCredentialsSection credentials={credentials} loading={loading} />
      <ActivityTimeline />
      <RequestCredentialSection />
    </div>
  );
}
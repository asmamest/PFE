import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Inbox, ShieldX, Clock, CheckCircle2, Bell, Menu } from "lucide-react";
import { toast } from "sonner";

import { IdentityHeader } from "@/components/issuer/IdentityHeader";
import { StatCard } from "@/components/issuer/StatCard";
import { PendingRequests, type CredentialRequest } from "@/components/issuer/PendingRequests";
import {
  IssuedCredentialsTable,
  type IssuedCredential,
  type CredentialStatus,
} from "@/components/issuer/IssuedCredentialsTable";
import { IssuanceChart } from "@/components/issuer/IssuanceChart";
import { RecentTransactions, type TxEvent } from "@/components/issuer/RecentTransactions";
import { DashboardSidebar } from "@/components/issuer/DashboardSidebar";
import { loadIssuerProfile, type IssuerProfile, saveIssuerProfile } from "@/lib/issuer-utils";

const day = 86_400_000;

// Build deterministic seed data from issuer's own credential types
function buildSeedData(types: string[], baseTs: number) {
  const safeTypes = types.length > 0 ? types : ["Credential générique"];
  const requests: CredentialRequest[] = [
    {
      id: "req_001",
      holder: "0x7B2d1e4f7a3c6b9d0e5f2a8c1b4d7e6f3a9c23F2",
      holderName: "Alice Martin",
      holderDid: "did:ethr:0x7B2d1e4f7a3c6b9d0e5f2a8c1b4d7e6f3a9c23F2",
      holderPublicKey: "ml-dsa-65:0x3a7c8d9e1f2a4b5c6d7e8f9a0b1c2d3e4f5a6b7c",
      credentialType: safeTypes[0],
      requestedAt: baseTs - 2 * day,
      message: `Demande pour ${safeTypes[0]} — promotion 2024.`,
    },
    {
      id: "req_002",
      holder: "0xA4c2b1d3e5f7a9b8c6d4e2f1a3b5c7d9e1f3a5b7",
      holderName: "Karim Benali",
      holderDid: "did:ethr:0xA4c2b1d3e5f7a9b8c6d4e2f1a3b5c7d9e1f3a5b7",
      holderPublicKey: "ml-dsa-65:0x8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c",
      credentialType: safeTypes[Math.min(1, safeTypes.length - 1)],
      requestedAt: baseTs - 5 * day,
    },
  ];
  const credentials: IssuedCredential[] = [
    {
      id: "cred_0xa1b2c3d4e5f6",
      holder: "0x9F8e7d6c5b4a3210fedcba9876543210abcdef12",
      type: safeTypes[0],
      issuedAt: baseTs - 30 * day,
      expiresAt: null,
      status: "active",
      txHash: "0x4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b",
    },
    {
      id: "cred_0xb2c3d4e5f6a7",
      holder: "0x123456789abcdef0123456789abcdef012345678",
      type: safeTypes[Math.min(1, safeTypes.length - 1)],
      issuedAt: baseTs - 90 * day,
      expiresAt: baseTs + 365 * day,
      status: "active",
      txHash: "0x5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c",
    },
    {
      id: "cred_0xc3d4e5f6a7b8",
      holder: "0xabcdef0123456789abcdef0123456789abcdef01",
      type: safeTypes[0],
      issuedAt: baseTs - 200 * day,
      expiresAt: baseTs - 10 * day,
      status: "expired",
      txHash: "0x6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d",
    },
    {
      id: "cred_0xd4e5f6a7b8c9",
      holder: "0x0987654321fedcba0987654321fedcba09876543",
      type: safeTypes[Math.min(2, safeTypes.length - 1)],
      issuedAt: baseTs - 60 * day,
      expiresAt: baseTs + 180 * day,
      status: "revoked",
      txHash: "0x7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e",
    },
  ];
  const events: TxEvent[] = credentials.map((c) => ({
    id: c.id + "_tx",
    type: c.status === "revoked" ? "revoked" : "issued",
    credentialId: c.id,
    holder: c.holder,
    txHash: c.txHash,
    timestamp: c.issuedAt,
  }));
  return { requests, credentials, events };
}

function IssuerDashboard() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<IssuerProfile | null>(null);
  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [credentials, setCredentials] = useState<IssuedCredential[]>([]);
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Essayer de charger le profil existant
    let p = loadIssuerProfile();
    
    // 2. Si pas de profil, créer un profil de test
    if (!p) {
      console.log("⚠️ Aucun profil trouvé, création d'un profil de test...");
      
      const testWallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb5";
      const testProfile: IssuerProfile = {
        walletAddress: testWallet,
        did: `did:ethr:${testWallet}`,
        publicKey: "ml-dsa-65:0x3a7c8d9e1f2a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e",
        legalName: "ENICarthage",
        credentialTypes: ["Diplôme Universitaire", "Certification Professionnelle", "Attestation de Compétence"],
        registeredAt: Date.now(),
        cid: "QmTest123456789",
        verificationTag: "edgedoc:demo:test123",
      };
      
      // Sauvegarder le profil
      saveIssuerProfile(testProfile);
      sessionStorage.setItem(`qsdid.issuer.${testWallet}`, JSON.stringify(testProfile));
      
      // Créer aussi une identity
      const testIdentity = {
        did: testProfile.did,
        walletAddress: testWallet,
        publicKey: testProfile.publicKey,
        role: "issuer",
        accountType: "organization",
        createdAt: Date.now(),
      };
      sessionStorage.setItem("qsdid.identity", JSON.stringify(testIdentity));
      
      p = testProfile;
    }
    
    setProfile(p);
    
    // 3. Générer les données seed avec les types du profil
    const seed = buildSeedData(p?.credentialTypes ?? [], Date.now());
    setRequests(seed.requests);
    setCredentials(seed.credentials);
    setEvents(seed.events);
    setLoading(false);
  }, []);

  const stats = useMemo(() => {
    const total = credentials.length;
    const active = credentials.filter((c) => c.status === "active").length;
    const revoked = credentials.filter((c) => c.status === "revoked").length;
    const expired = credentials.filter((c) => c.status === "expired").length;
    const pending = requests.length;
    return { total, active, revoked, expired, pending };
  }, [credentials, requests]);

  const handleIssue = async (req: CredentialRequest, expiration: number | null, _file: File) => {
    await new Promise((r) => setTimeout(r, 1500));
    const id = `cred_0x${Math.random().toString(16).slice(2, 14)}`;
    const txHash = `0x${Math.random().toString(16).slice(2).padEnd(64, "0").slice(0, 64)}`;
    const newCred: IssuedCredential = {
      id,
      holder: req.holder,
      type: req.credentialType,
      issuedAt: Date.now(),
      expiresAt: expiration,
      status: "active",
      txHash,
    };
    setCredentials((prev) => [newCred, ...prev]);
    setEvents((prev) => [
      { id: id + "_tx", type: "issued", credentialId: id, holder: req.holder, txHash, timestamp: Date.now() },
      ...prev,
    ]);
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    toast.success("Credential émis", { description: `Type : ${req.credentialType}` });
  };

  const handleReject = (req: CredentialRequest, _reason: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
  };

  const handleRevoke = (id: string, _reason: string) => {
    setCredentials((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "revoked" as CredentialStatus } : c)),
    );
    const cred = credentials.find((c) => c.id === id);
    if (cred) {
      setEvents((prev) => [
        {
          id: id + "_rev_" + Date.now(),
          type: "revoked",
          credentialId: id,
          holder: cred.holder,
          txHash: cred.txHash,
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("qsdid.identity");
    sessionStorage.removeItem("qsdid.issuerProfile");
    if (profile?.walletAddress) {
      sessionStorage.removeItem(`qsdid.issuer.${profile.walletAddress}`);
    }
    toast.success("Déconnecté");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar onLogout={handleLogout} pendingCount={requests.length} />

      <div className="flex-1">
        {/* Top bar - VERSION AGRANDIE */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 sm:px-8">
            
            {/* Partie gauche - Logo et titre */}
            <div className="flex items-center gap-3">
              <button className="lg:hidden text-muted-foreground" aria-label="Menu">
                <Menu className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-foreground">Issuer Dashboard</h1>
                {profile?.legalName && (
                  <p className="text-sm text-muted-foreground mt-0.5">{profile.legalName}</p>
                )}
              </div>
            </div>
            
            {/* Partie droite - IdentityHeader et notifications */}
            <div className="flex items-center gap-4">
              {profile && (
                <IdentityHeader
                  walletAddress={profile.walletAddress}
                  did={profile.did}
                  publicKey={profile.publicKey}
                  role="issuer"
                  registeredAt={profile.registeredAt}
                />
              )}
              
              {/* Bouton notifications agrandi */}
              <div className="relative">
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {requests.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
                      {requests.length}
                    </span>
                  )}
                </button>
                
                {notifOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-popover p-4 shadow-xl">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Notifications
                    </p>
                    {requests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Tout est à jour</p>
                    ) : (
                      <ul className="space-y-3">
                        {requests.slice(0, 5).map((r) => (
                          <li key={r.id} className="rounded-md bg-secondary/40 p-3 text-sm">
                            <p className="font-medium text-foreground">Nouvelle demande : {r.credentialType}</p>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{r.holder.slice(0, 12)}…</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="space-y-6 p-4 sm:p-6">
          <motion.div
            id="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="scroll-mt-20 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
          >
            <StatCard label="Credentials émis" value={stats.total} icon={BadgeCheck} subtext="Total" delay={0} />
            <StatCard label="Actifs" value={stats.active} icon={CheckCircle2} tone="success" delay={0.05} />
            <StatCard label="Révoqués" value={stats.revoked} icon={ShieldX} tone="destructive" delay={0.1} />
            <StatCard label="Expirés" value={stats.expired} icon={Clock} tone="warning" delay={0.15} />
            <StatCard label="En attente" value={stats.pending} icon={Inbox} tone="warning" subtext="À traiter" delay={0.2} />
          </motion.div>

          <div id="requests" className="scroll-mt-20 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <PendingRequests requests={requests} onIssue={handleIssue} onReject={handleReject} />
            </div>
            <div className="lg:col-span-2">
              <IssuanceChart credentials={credentials} />
            </div>
          </div>

          <div id="credentials" className="scroll-mt-20">
            <IssuedCredentialsTable credentials={credentials} onRevoke={handleRevoke} />
          </div>

          <div id="transactions" className="scroll-mt-20">
            <RecentTransactions events={events} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default IssuerDashboard;
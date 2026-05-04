import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Inbox, ShieldX, Clock, CheckCircle2, Bell, Menu, Loader2 } from "lucide-react";
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
import { ethers } from "ethers";
import { USER_REGISTRY_ADDRESS, CREDENTIAL_REGISTRY_ADDRESS } from "@/lib/blockchain/constants";
import userRegistryAbi from "@/lib/blockchain/UserRegistryAbi.json";
import credentialRegistryAbi from "@/lib/blockchain/CredentialRegistryAbi.json";
import { fetchFromIPFS, ipfs } from "@/lib/ipfs/ipfsClient";

import { loadEncryptedMLDSAKey } from "@/lib/secureStorage";
import { getPRFKey } from "@/lib/webauthnPrf";
import { decryptWithPRF } from "@/lib/cryptoWrapper";
import { issueCredential } from "@/lib/blockchain/CredentialRegistryService";

const API_BASE = "http://localhost:8083";

interface IssuerProfile {
  walletAddress: string;
  did: string;
  publicKey: string;
  legalName: string;
  credentialTypes: string[];
  registeredAt: number;
  cid: string;
  verificationTag: string;
}

// ========== FONCTIONS UTILITAIRES ==========

/**
 * Calcule le hash Keccak‑256 (équivalent SHA‑3) d'une chaîne ou d'un Uint8Array.
 */
function keccak256Hash(data: string | Uint8Array): string {
  if (typeof data === 'string') {
    return ethers.keccak256(ethers.toUtf8Bytes(data));
  }
  return ethers.keccak256(data);
}

// ========== CHARGEMENT DES DONNÉES ==========

async function loadIssuerIdentity(walletAddress: string): Promise<IssuerProfile | null> {
  try {
    if (!window.ethereum) throw new Error("MetaMask not available");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, userRegistryAbi, provider);
    const user = await contract.getUser(walletAddress);
    if (!user || !user.active) return null;

    const rolesMask = Number(user.roles);
    if (!(rolesMask & 1)) return null; // ROLE_ISSUER = 1

    const cid = user.metadataCID;
    const didDoc = await fetchFromIPFS(cid);
    const legalName = didDoc.legalName || "Unknown Issuer";
    const credentialTypes = didDoc.credentialTypes || [];
    const publicKeyMultibase = didDoc.verificationMethod?.[0]?.publicKeyMultibase || "";
    const verificationTag = didDoc.verificationTag || "";

    return {
      walletAddress,
      did: `did:zk:${walletAddress}`,
      publicKey: publicKeyMultibase,
      legalName,
      credentialTypes,
      registeredAt: Number(user.registeredAt) * 1000,
      cid,
      verificationTag,
    };
  } catch (err) {
    console.error("loadIssuerIdentity error:", err);
    return null;
  }
}

async function loadIssuedCredentials(issuerAddress: string): Promise<IssuedCredential[]> {
  try {
    if (!window.ethereum) throw new Error("MetaMask not available");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(CREDENTIAL_REGISTRY_ADDRESS, credentialRegistryAbi, provider);
    // ✅ Utilisation de la bonne méthode : getIssuerCredentials
    const credentialIds: string[] = await contract.getIssuerCredentials(issuerAddress);
    const credentials: IssuedCredential[] = [];

    for (const id of credentialIds) {
      const cred = await contract.getCredential(id);
      const statusCode = Number(cred.status);
      let status: CredentialStatus;
      if (statusCode === 0) status = "active";
      else if (statusCode === 1) status = "revoked";
      else if (statusCode === 2) status = "expired";
      else status = "active";

      let credentialType = "Credential";
      if (cred.metadataCID) {
        const meta = await fetchFromIPFS(cred.metadataCID);
        credentialType = meta.type || credentialType;
      }

      const issuedAt = Number(cred.issuedAt) * 1000;
      const expiresAt = cred.expiresAt === 0n || cred.expiresAt === 0 ? null : Number(cred.expiresAt) * 1000;

      credentials.push({
        id,
        holder: cred.holder,
        type: credentialType,
        issuedAt,
        expiresAt,
        status,
        txHash: "", // Le contrat ne stocke pas txHash, on peut le laisser vide ou le récupérer via events
      });
    }
    return credentials;
  } catch (err) {
    console.error("loadIssuedCredentials error:", err);
    return [];
  }
}

async function loadTransactions(issuerAddress: string): Promise<TxEvent[]> {
  try {
    if (!window.ethereum) throw new Error("MetaMask not available");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(CREDENTIAL_REGISTRY_ADDRESS, credentialRegistryAbi, provider);
    
    // Récupérer le bloc actuel pour limiter la recherche (optionnel)
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 10000; // Derniers 10000 blocs (ajuster selon besoin)
    
    // Filtrer les events CredentialIssued où l'issuer correspond
    const issuedFilter = contract.filters.CredentialIssued(null, issuerAddress);
    const issuedEvents = await contract.queryFilter(issuedFilter, fromBlock);
    
    // Filtrer les events CredentialRevoked où l'issuer correspond
    const revokedFilter = contract.filters.CredentialRevoked(null, issuerAddress);
    const revokedEvents = await contract.queryFilter(revokedFilter, fromBlock);
    
    const events: TxEvent[] = [];
    
    for (const event of issuedEvents) {
      const decoded = contract.interface.parseLog(event);
      if (!decoded) continue;
      const credentialId = decoded.args.credentialId;
      const holder = decoded.args.holder;
      const txHash = event.transactionHash;
      const timestamp = (await event.getBlock()).timestamp;
      events.push({
        id: `${credentialId}_issued`,
        type: "issued",
        credentialId,
        holder,
        txHash,
        timestamp: timestamp * 1000,
      });
    }
    
    for (const event of revokedEvents) {
      const decoded = contract.interface.parseLog(event);
      if (!decoded) continue;
      const credentialId = decoded.args.credentialId;
      const holder = undefined; // L'event CredentialRevoked ne contient pas holder par défaut, mais on peut le récupérer depuis le credential
      const txHash = event.transactionHash;
      const timestamp = (await event.getBlock()).timestamp;
      events.push({
        id: `${credentialId}_revoked`,
        type: "revoked",
        credentialId,
        holder,
        txHash,
        timestamp: timestamp * 1000,
      });
    }
    
    // Trier par timestamp décroissant
    events.sort((a, b) => b.timestamp - a.timestamp);
    return events;
  } catch (err) {
    console.error("loadTransactions error:", err);
    return [];
  }
}

async function loadPendingRequests(issuerAddress: string): Promise<CredentialRequest[]> {
  try {
    const res = await fetch(`http://localhost:8083/credential-requests?issuer=${issuerAddress}&status=pending`);
    if (!res.ok) return [];
    const data = await res.json();
    // Transformer les champs du backend vers ceux attendus par le composant PendingRequests
    return (data.requests || []).map((req: any) => ({
      id: req.id,
      holder: req.holder,
      credentialType: req.credential_type,
      message: req.message,
      status: req.status,
      requestedAt: req.requested_at * 1000,
    }));

  } catch (err) {
    console.error("loadPendingRequests error:", err);
    return [];
  }
}

async function enrichRequestsWithHolderInfo(requests: any[]): Promise<CredentialRequest[]> {
  const enriched = await Promise.all(requests.map(async (req) => {
    // req contient déjà id, holder, credentialType, message, status, requestedAt (en ms)
    let holderName = "";
    let holderDid = "";
    let holderPublicKey = "";
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, userRegistryAbi, provider);
      const user = await contract.getUser(req.holder);
      if (user && user.active) {
        const cid = user.metadataCID;
        if (cid) {
          const profile = await fetchFromIPFS(cid);
          holderName = profile.fullName || "";
        }
        holderDid = `did:zk:${req.holder}`;
      }
    } catch (err) {
      console.error(`Failed to fetch holder info for ${req.holder}:`, err);
    }
    // Conserver toutes les propriétés déjà existantes, ajouter les nouvelles
    return {
      ...req,               // garde id, holder, credentialType, message, status, requestedAt
      holderName,
      holderDid,
      holderPublicKey,
    };
  }));
  return enriched;
}

function IssuerDashboard() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<IssuerProfile | null>(null);
  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [credentials, setCredentials] = useState<IssuedCredential[]>([]);
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false); // état pour le bouton d'émission


  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (!window.ethereum) {
          toast.error("MetaMask not installed");
          navigate("/login");
          return;
        }
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        let addr = accounts?.[0];
        if (!addr) {
          const newAccounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          addr = newAccounts?.[0];
        }
        if (!addr) {
          navigate("/login");
          return;
        }
        const issuerProfile = await loadIssuerIdentity(addr);
        if (!issuerProfile) {
          toast.error("Vous n'êtes pas enregistré en tant qu'issuer. Veuillez compléter l'onboarding.");
          navigate("/onboarding");
          return;
        }
        setProfile(issuerProfile);

        const creds = await loadIssuedCredentials(addr);
        setCredentials(creds);

        // Chargement des demandes en attente depuis le backend
        const pendingReqs = await loadPendingRequests(addr);
        const enrichedReqs = await enrichRequestsWithHolderInfo(pendingReqs);
        setRequests(enrichedReqs);

      
        const txs = await loadTransactions(addr);
        setEvents(txs);

      } catch (err) {
        console.error(err);
        toast.error("Erreur lors du chargement du tableau de bord");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const stats = useMemo(() => {
    const total = credentials.length;
    const active = credentials.filter((c) => c.status === "active").length;
    const revoked = credentials.filter((c) => c.status === "revoked").length;
    const expired = credentials.filter((c) => c.status === "expired").length;
    const pending = requests.length;
    return { total, active, revoked, expired, pending };
  }, [credentials, requests]);

  // ========== HANDLE ISSUE (ÉMISSION D'UN CREDENTIAL) ==========
  const handleIssue = async (req: CredentialRequest, expiration: number | null, file: File) => {
    if (!file) {
      toast.error("Veuillez sélectionner un document");
      return;
    }
    if (!profile?.walletAddress) {
      toast.error("Profil issuer non chargé");
      return;
    }

    setIssuing(true);

    try {
      // 1. Lire le fichier et calculer docHash
      const fileBuffer = await file.arrayBuffer();
      const fileBytes = new Uint8Array(fileBuffer);
      const docHash = ethers.keccak256(fileBytes);

      // 2. Simulation EdgeDoc AI : génération d'un masque et d'un score
      //    (à remplacer par un vrai appel à votre service)
      await new Promise(resolve => setTimeout(resolve, 1500));
      const maskData = new TextEncoder().encode(`AI-segmentation-mask-for-${docHash}`);
      const { cid: maskCID } = await ipfs.add(maskData);
      const maskHash = ethers.keccak256(maskData);
      const classificationScore = 98.5; // score de confiance

      // 3. Récupération des clés privées de l'issuer (déchiffrement via PRF)
      const encryptedData = await loadEncryptedMLDSAKey(profile.walletAddress);
      if (!encryptedData) throw new Error("Clé privée introuvable");
      const prfKey = await getPRFKey(encryptedData.credentialId);
      const decryptedJson = await decryptWithPRF(prfKey, encryptedData.ciphertext, encryptedData.iv);
      const privateKeys = JSON.parse(decryptedJson); // { pq_secret, classical_secret, pq_public, classical_public }

      // 4. Construction du payload composite (tous les éléments liés)
      const now = Date.now();
      const compositePayload = {
        docHash,
        maskHash,
        classificationScore: Math.round(classificationScore * 100), // entier
        holder: req.holder,
        issuer: profile.walletAddress,
        issuedAt: now,
        expiryDate: expiration || null,
        credentialType: req.credentialType,
      };
      // Sérialisation déterministe (tri des clés)
      const sortedKeys = Object.keys(compositePayload).sort();
      const compositeString = JSON.stringify(compositePayload, sortedKeys);
      const compositeHash = ethers.keccak256(ethers.toUtf8Bytes(compositeString));

      // 5. Signature du compositeHash par l'issuer (via backend)
      const payloadB64 = btoa(compositeString);
      const signResponse = await fetch(`${API_BASE}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: payloadB64,
          private_key: {
            pq_secret: privateKeys.pq_secret,
            classical_secret: privateKeys.classical_secret,
            pq_public: privateKeys.pq_public,
            classical_public: privateKeys.classical_public,
          }
        })
      });
      if (!signResponse.ok) {
        const errText = await signResponse.text();
        throw new Error(`Signature failed: ${errText}`);
      }
      const signatureData = await signResponse.json();

      // 6. Stockage sur IPFS du bundle complet (credential + signature)
      const credentialBundle = {
        name: req.credentialType,
        docHash,
        maskHash,
        maskCID: maskCID.toString(),
        classificationScore,
        compositeHash,
        signature: signatureData.signature_json,
        signatureId: signatureData.signature_id,
        issuer: profile.walletAddress,
        holder: req.holder,
        issuedAt: now,
        expiryDate: expiration,
        credentialType: req.credentialType,
        aiVerified: true, // à remplacer par le vrai résultat d'EdgeDoc
      };
      const bundleBuffer = new TextEncoder().encode(JSON.stringify(credentialBundle));
      const { cid: bundleCID } = await ipfs.add(bundleBuffer);
      const ipfsCID = bundleCID.toString();

      // 7. Métadonnées (affichage frontend)
      const metadata = {
        credentialType: req.credentialType,
        message: req.message || "",
        issuedAt: now,
        expiresAt: expiration,
      };
      const metadataBuffer = new TextEncoder().encode(JSON.stringify(metadata));
      const { cid: metadataCID } = await ipfs.add(metadataBuffer);
      const metadataCIDString = metadataCID.toString();

      // 8. Appel au contrat CredentialRegistry
      const expiresAtSeconds = expiration ? Math.floor(expiration / 1000) : 0;
      const credentialId = await issueCredential(
        compositeHash,        // docHash du contrat (on y stocke le compositeHash)
        ipfsCID,
        req.holder,
        expiresAtSeconds,
        metadataCIDString
      );

      toast.success(`Credential émis avec succès ! ID: ${credentialId}`);

      // 9. Mise à jour de la demande dans le backend
      await fetch(`${API_BASE}/credential-requests/update/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: "approved", credentialId }),
      });

      // 10. Rafraîchir les listes
      const pendingReqs = await loadPendingRequests(profile.walletAddress);
      const enrichedReqs = await enrichRequestsWithHolderInfo(pendingReqs);
      setRequests(enrichedReqs);
      const creds = await loadIssuedCredentials(profile.walletAddress);
      setCredentials(creds);

    } catch (err: any) {
      console.error(err);
      toast.error(`Erreur lors de l'émission : ${err.message}`);
    } finally {
      setIssuing(false);
    }
  };

  const handleReject = (req: CredentialRequest, _reason: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
  };

  const handleRevoke = (id: string, _reason: string) => {
    // Implémenter l’appel au contrat pour révoquer
    toast.info("Fonctionnalité à implémenter");
  };

  const handleLogout = () => {
    sessionStorage.clear();
    toast.success("Déconnecté");
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Aucune identité issuer trouvée</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vous devez d'abord vous enregistrer en tant qu'issuer.
          </p>
          <button className="mt-4 rounded-md bg-primary px-4 py-2 text-white" onClick={() => navigate("/onboarding")}>
            Aller à l'enregistrement
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar onLogout={handleLogout} pendingCount={requests.length} />

      <div className="flex-1">
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 sm:px-8">
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

            <div className="flex items-center gap-4">
              <IdentityHeader
                walletAddress={profile.walletAddress}
                did={profile.did}
                publicKey={profile.publicKey}
                role="issuer"
                registeredAt={profile.registeredAt}
              />

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
                      <p className="text-sm text-muted-foreground">Aucune demande en attente</p>
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
          >
            <StatCard label="Credentials émis" value={stats.total} icon={BadgeCheck} subtext="Total" delay={0} />
            <StatCard label="Actifs" value={stats.active} icon={CheckCircle2} tone="success" delay={0.05} />
            <StatCard label="Révoqués" value={stats.revoked} icon={ShieldX} tone="destructive" delay={0.1} />
            <StatCard label="Expirés" value={stats.expired} icon={Clock} tone="warning" delay={0.15} />
            <StatCard label="En attente" value={stats.pending} icon={Inbox} tone="warning" subtext="À traiter" delay={0.2} />
          </motion.div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <PendingRequests requests={requests} onIssue={handleIssue} onReject={handleReject} />
            </div>
            <div className="lg:col-span-2">
              <IssuanceChart credentials={credentials} />
            </div>
          </div>

          <div>
            <IssuedCredentialsTable credentials={credentials} onRevoke={handleRevoke} />
          </div>

          <div>
            <RecentTransactions events={events} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default IssuerDashboard;
import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, CheckCircle2, LayoutDashboard, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

import IssuerRegistrationForm from "@/components/IssuerRegistrationForm";
import { saveIssuerProfile } from "@/lib/issuer-utils";
import { getUserMetadataCID, updateUserMetadataCID } from "@/lib/blockchain/UserRegistryService";
import { addFullNameToHolderProfile } from "@/lib/ipfs/ipfsClient";

type AccountType = "individual" | "organization";

export default function RegistrationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const role = searchParams.get("role") || "issuer";
  const type = (searchParams.get("type") as AccountType) || "individual";
  const wallet = searchParams.get("wallet") || "0x0000000000000000000000000000000000000000";

  const [completed, setCompleted] = useState<{
    cid: string;
    verificationTag: string;
  } | null>(null);

  // ========== PARTIE HOLDER ==========
  const isHolder = role === "holder";
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleHolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: "Erreur", description: "Le nom complet est requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // 1. Récupérer l'ancien CID depuis la blockchain
      const oldCID = await getUserMetadataCID(wallet);
      if (!oldCID) throw new Error("Aucun profil holder trouvé sur la blockchain");

      // 2. Ajouter le fullName et obtenir un nouveau CID
      const newCID = await addFullNameToHolderProfile(oldCID, fullName);

      // 3. Mettre à jour le metadataCID sur le contrat
      await updateUserMetadataCID(newCID);

      toast({ title: "Profil enregistré", description: "Bienvenue !" });
      navigate("/holder");
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // Affichage du formulaire holder
  if (isHolder) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="pointer-events-none absolute inset-0 bg-grid" />
        <div className="absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-[120px]" />
        <div className="relative z-10 w-full max-w-md">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-6 backdrop-blur-xl shadow-2xl">
            <div className="flex flex-col items-center gap-2 mb-6">
              <Shield className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold">QS·DID</span>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Holder Registration
              </p>
            </div>

            <form onSubmit={handleHolderSubmit} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Nom complet *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jean Dupont"
                  required
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Ce nom sera associé à votre identifiant décentralisé.
                </p>
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Enregistrement sur IPFS & blockchain..." : "Enregistrer mon identité"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ========== PARTIE ISSUER (inchangée) ==========
  if (completed) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background bg-grid px-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-success/5 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md rounded-2xl border border-success/20 bg-card/80 p-8 backdrop-blur-xl text-center"
        >
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center glow-success">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Enregistrement réussi</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Votre identité d'émetteur a été ancrée sur la blockchain.
          </p>

          <div className="mt-6 space-y-3">
            <InfoRow label="CID IPFS" value={completed.cid} mono />
            <InfoRow label="Tag de vérification" value={completed.verificationTag} mono />
            <InfoRow label="Rôle" value={role} />
            <InfoRow label="Type" value={type} />
            <InfoRow label="Wallet" value={`${wallet.slice(0, 6)}…${wallet.slice(-4)}`} mono />
          </div>

          <Button
            onClick={() => navigate("/issuer/dashboard")}
            className="mt-6 w-full gap-2"
          >
            <LayoutDashboard className="h-4 w-4" />
            Accéder au dashboard Issuer
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background bg-grid px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="rounded-2xl border border-border bg-card/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <IssuerRegistrationForm
            accountType={type}
            walletAddress={wallet}
            onComplete={({ verificationTag, cid, formData }) => {
              // ===== SAUVEGARDE COMPLÈTE DU PROFIL =====
              let existingIdentity = null;
              try {
                const identityRaw = sessionStorage.getItem("qsdid.identity");
                if (identityRaw) {
                  existingIdentity = JSON.parse(identityRaw);
                }
              } catch (e) {
                console.error("Error loading identity:", e);
              }

              const identity = existingIdentity || {
                did: `did:ethr:${wallet}`,
                walletAddress: wallet,
                publicKey: "temp-public-key",
                role: "issuer",
                accountType: type,
                createdAt: Date.now(),
              };

              identity.role = "issuer";
              identity.accountType = type;

              sessionStorage.setItem("qsdid.identity", JSON.stringify(identity));

              const issuerProfile = {
                walletAddress: wallet,
                did: identity.did,
                publicKey: identity.publicKey,
                legalName: formData.legalName,
                credentialTypes: formData.credentialTypes,
                registeredAt: identity.createdAt,
                cid: cid,
                verificationTag: verificationTag,
              };

              saveIssuerProfile(issuerProfile);
              sessionStorage.setItem(`qsdid.issuer.${wallet}`, JSON.stringify(issuerProfile));

              const registrationData = {
                formData,
                cid,
                verificationTag,
                timestamp: Date.now(),
              };
              sessionStorage.setItem("qsdid.registration", JSON.stringify(registrationData));

              console.log("✅ Profil issuer sauvegardé:", issuerProfile);

              setCompleted({ cid, verificationTag });
            }}
          />
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <Shield className="h-3 w-3" />
          Post-Quantum Identity · ML-DSA-65 · EdgeDoc AI Verification
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-secondary/30 px-3 py-2">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span
        className={`text-xs text-foreground ${mono ? "font-mono" : ""} max-w-[200px] truncate`}
      >
        {value}
      </span>
    </div>
  );
}
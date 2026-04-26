// src/pages/Onboarding.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import {
  Shield,
  ShieldCheck,
  KeyRound,
  Wallet,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

import { useAuthMachine, type AuthState } from "@/lib/qsdid/stateMachine";
import { audit } from "@/lib/qsdid/audit";
import { createPasskeyWithPRF, getPRFKey, isPRFSupported } from "@/lib/webauthnPrf";
import { encryptWithPRF } from "@/lib/cryptoWrapper";
import { storeEncryptedMLDSAKey } from "@/lib/secureStorage";
import {
  initWasm,
  healthCheck,
  generateHybridKeys,
  getChallenge,
  signDocumentWithChallenge,
  verifySignature,
  encodeUtf8ToB64,
  type HybridKeyPair,
} from "@/lib/qsdid/wasmClient";
import { createTotp, persistTotpDev, verifyTotp } from "@/lib/qsdid/totp";

const API_BASE = "http://localhost:8083";

type StepKey = "totp" | "init" | "wallet" | "passkey" | "done";

const stepOrder = [
  { key: "totp", label: "Authenticator", icon: <ScanLine className="h-4 w-4" /> },
  { key: "init", label: "Initialisation", icon: <Shield className="h-4 w-4" /> },
  { key: "wallet", label: "Wallet", icon: <Wallet className="h-4 w-4" /> },
  { key: "passkey", label: "Sécurité", icon: <KeyRound className="h-4 w-4" /> },
  { key: "done", label: "Finalisation", icon: <ShieldCheck className="h-4 w-4" /> },
];

function stateToStep(s: AuthState): StepKey {
  switch (s) {
    case "INIT":
    case "TOTP_SETUP": return "totp";
    case "TOTP_VERIFIED": return "init";
    case "BACKEND_READY":
    case "KEYS_GENERATED":
    case "CHALLENGE_REQUESTED":
    case "CHALLENGE_RECEIVED":
    case "SIGNED":
    case "VERIFIED": return "init"; // toutes ces étapes techniques sont invisibles
    case "WALLET_CONNECTED": return "wallet";
    case "PASSKEY_READY": return "passkey";
    case "AUTHENTICATED": return "done";
    default: return "totp";
  }
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { state, send } = useAuthMachine();
  const step = stateToStep(state);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initProgress, setInitProgress] = useState<string>("");

  // TOTP
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  // PQC
  const [keys, setKeys] = useState<HybridKeyPair | null>(null);

  // Wallet
  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [role, setRole] = useState<"holder" | "issuer" | "verifier">("holder");
  const [accountType, setAccountType] = useState<"individual" | "organization">("individual");
  const did = useMemo(() => (walletAddr ? `did:zk:${walletAddr}` : null), [walletAddr]);

  const [prfSupported, setPrfSupported] = useState(false);

  useEffect(() => {
    let mounted = true;
    isPRFSupported().then(supported => {
      if (mounted) setPrfSupported(supported);
    }).catch(() => setPrfSupported(false));
    return () => { mounted = false; };
  }, []);

  // Initialisation WASM + TOTP
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initWasm(API_BASE);
      } catch (e) {
        setError(`WASM init failed: ${(e as Error).message}`);
        return;
      }
      if (cancelled) return;
      const ref = `dev-${Date.now()}`;
      const { secret, uri } = createTotp(ref);
      setTotpSecret(secret);
      const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
      if (!cancelled) setQrDataUrl(qr);
      send("TOTP_SETUP_STARTED");
    })();
    return () => { cancelled = true; };
  }, [send]);

  const verifyTotpCode = useCallback(() => {
    if (!totpSecret) return;
    if (!verifyTotp(totpSecret, totpCode)) {
      setError("Invalid authenticator code");
      return;
    }
    setError(null);
    send("TOTP_VERIFIED");
  }, [totpSecret, totpCode, send]);

  // Regroupe backend check, génération de clés, signature et vérification
  const runInitialisation = useCallback(async () => {
    setBusy(true);
    setError(null);
    setInitProgress("Vérification du backend...");
    try {
      await healthCheck();
      send("BACKEND_OK");
      setInitProgress("Génération des clés post‑quantiques...");
      const k = await generateHybridKeys();
      setKeys(k);
      send("KEYS_GENERATED");
      setInitProgress("Signature d’un challenge de test...");
      send("CHALLENGE_REQUESTED");
      const challenge = await getChallenge("registration");
      send("CHALLENGE_RECEIVED");
      const documentToSign = {
        ctx: "registration",
        nonce: challenge.nonce,
        challenge_id: challenge.challenge_id,
        timestamp: Date.now()
      };
      const docB64 = encodeUtf8ToB64(JSON.stringify(documentToSign));
      const sig = await signDocumentWithChallenge(docB64, challenge.challenge_id);
      send("SIGNED");
      const v = await verifySignature(sig.signature_id, docB64);
      if (!v?.valid) throw new Error("Vérification échouée");
      send("VERIFIED");
      send("WALLET_CONNECTED");
    } catch (err: any) {
      setError(`Initialisation échouée : ${err.message}`);
    } finally {
      setBusy(false);
      setInitProgress("");
    }
  }, [send]);

  useEffect(() => {
    if (state === "TOTP_VERIFIED" && !busy && !keys) {
      runInitialisation();
    }
  }, [state, busy, keys, runInitialisation]);

  const runConnectWallet = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const eth = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } }).ethereum;
      if (!eth) throw new Error("MetaMask not detected");
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0];
      if (!addr) throw new Error("No account returned");
      setWalletAddr(addr);
      send("WALLET_DONE");
    } catch (e) {
      setError(`Wallet connection failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [send]);

  const createPRFPasskey = useCallback(async () => {
    if (!keys || !walletAddr) {
      setError("Clés non générées ou wallet manquant");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (!prfSupported) throw new Error("PRF non supporté.");
      const { credentialId } = await createPasskeyWithPRF(walletAddr, `issuer_${walletAddr.slice(0, 8)}`);
      const prfKey = await getPRFKey(credentialId);
      if (!(prfKey instanceof CryptoKey)) throw new Error("Clé PRF invalide");
      const { ciphertext, iv } = await encryptWithPRF(prfKey, keys.private_key);
      await storeEncryptedMLDSAKey(walletAddr, { ciphertext, iv, credentialId });
      setKeys(prev => prev ? { ...prev, private_key: "***ENCRYPTED***" } : null);
      send("PASSKEY_DONE");
      toast({ title: "Passkey créée", description: "Clé ML-DSA protégée par biométrie." });
    } catch (err: any) {
      console.error(err);
      setError(`Échec création passkey : ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, [keys, walletAddr, prfSupported, send]);

  const finalize = useCallback(() => {
    if (!walletAddr || !keys || !totpSecret || !did) return;
    persistTotpDev(did, totpSecret);
    const identity = {
      did,
      walletAddress: walletAddr,
      totpRef: did,
      publicKey: keys.public_key,
      role,
      accountType,
      createdAt: Date.now(),
    };
    sessionStorage.setItem("qsdid.identity", JSON.stringify(identity));
    send("ACCESS_GRANTED");
    toast({ title: "Identity anchored", description: did });
    if (role === "holder") {
      navigate("/holder");
    } else {
      const params = new URLSearchParams({ role, type: accountType, wallet: walletAddr });
      navigate(`/registration?${params.toString()}`);
    }
  }, [walletAddr, keys, totpSecret, did, role, accountType, send, navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(...)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-[420px] w-[420px] rounded-full bg-primary/5 blur-[100px]" />

      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-10 w-full max-w-lg">
        <div className="rounded-2xl border border-border/60 bg-card/80 shadow-lg backdrop-blur-xl">
          {/* Header */}
          <div className="flex flex-col items-center gap-2 border-b border-border/40 px-6 pt-7 pb-5">
            <div className="flex items-center gap-2">
              <img src={logo} alt="QS·DID" className="h-9 w-9" />
              <span className="text-xl font-bold tracking-tight">QS<span className="text-primary">·</span>DID</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Post-Quantum Identity · ML-DSA-65</p>
          </div>

          {/* Stepper */}
          <div className="flex items-center justify-between gap-1 border-b border-border/40 px-4 py-3">
            {stepOrder.map((s, i) => {
              const idx = stepOrder.findIndex(x => x.key === step);
              const reached = i <= idx;
              const active = i === idx;
              return (
                <div key={s.key} className="flex flex-1 items-center gap-1">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : reached ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
                    {reached && !active ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.icon}
                  </div>
                  {i < stepOrder.length - 1 && <div className={`h-px flex-1 ${reached ? "bg-primary/40" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>

          <div className="px-6 py-6">
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            <AnimatePresence mode="wait">
              {step === "totp" && (
                <motion.div key="totp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-base font-semibold">Setup authenticator</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Scan the QR code with Google Authenticator and enter the 6-digit code.</p>
                  <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 p-4">
                    {qrDataUrl ? <img src={qrDataUrl} alt="TOTP QR" className="h-44 w-44 rounded-md bg-background p-2" /> : <Loader2 className="h-5 w-5 animate-spin" />}
                  </div>
                  <div className="mt-4">
                    <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" className="text-center font-mono tracking-[0.4em]" />
                  </div>
                  <Button onClick={verifyTotpCode} disabled={totpCode.length !== 6} className="mt-4 w-full">Verify code <ChevronRight className="ml-1 h-4 w-4" /></Button>
                </motion.div>
              )}

              {step === "init" && (
                <motion.div key="init" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <h2 className="text-base font-semibold text-center">Initialisation sécurisée</h2>
                    <p className="text-xs text-muted-foreground text-center">{initProgress || "Préparation de votre identité post‑quantique..."}</p>
                  </div>
                </motion.div>
              )}

              {step === "wallet" && (
                <motion.div key="wallet" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-base font-semibold">Connect MetaMask</h2>
                  <Button onClick={runConnectWallet} disabled={busy} className="mt-4 w-full">Connect MetaMask</Button>
                </motion.div>
              )}

              {step === "passkey" && (
                <motion.div key="passkey" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-base font-semibold">Protégez votre clé privée</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Nous allons créer une passkey biométrique (Windows Hello, Touch ID) qui chiffrera votre clé ML-DSA.</p>
                  <Button onClick={createPRFPasskey} disabled={busy || !prfSupported} className="mt-4 w-full">Créer ma passkey biométrique</Button>
                </motion.div>
              )}

              {step === "done" && (
                <motion.div key="done" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h2 className="text-base font-semibold">Finalisation</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Choisissez votre rôle et terminez l’enregistrement.</p>
                  <div className="mt-4">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Role</div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(["holder", "issuer", "verifier"] as const).map(r => (
                        <button key={r} onClick={() => setRole(r)} className={`rounded-md border px-2 py-2 text-[11px] capitalize ${role === r ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30"}`}>{r}</button>
                      ))}
                    </div>
                  </div>
                  {role !== "holder" && (
                    <div className="mt-3">
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">Account type</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {(["individual", "organization"] as const).map(t => (
                          <button key={t} onClick={() => setAccountType(t)} className={`rounded-md border px-2 py-2 text-[11px] capitalize ${accountType === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30"}`}>{t}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button onClick={finalize} className="mt-4 w-full">Finaliser et continuer</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between border-t border-border/40 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-accent" />
              <span className="text-[10px] uppercase tracking-wider">État: <span className="text-foreground">{state}</span></span>
            </div>
            <button onClick={() => navigate("/login")} className="text-[10px] uppercase hover:underline">Déjà inscrit ? Se connecter</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
// src/pages/Login.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, KeyRound, Wallet, AlertTriangle, Bug, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuthMachine } from "@/lib/qsdid/stateMachine";
import { audit } from "@/lib/qsdid/audit";
import {
  initWasm,
  healthCheck,
  getChallenge,
  signDocumentWithChallenge,
  verifySignature,
  encodeUtf8ToB64,
} from "@/lib/qsdid/wasmClient";
import { loadTotpDev, verifyTotp } from "@/lib/qsdid/totp";

const API_BASE = "http://localhost:8083";

type Identity = {
  did: string;
  walletAddress: string;
  totpRef: string;
  publicKey?: string;
};

function loadIdentity(): Identity | null {
  try {
    const raw = sessionStorage.getItem("qsdid.identity");
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export default function Login() {
  const navigate = useNavigate();
  const { state, send } = useAuthMachine();
  const identity = useMemo(loadIdentity, []);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  
  // État pour le debug
  const [showDebug, setShowDebug] = useState(false);
  const [debugChallenge, setDebugChallenge] = useState<any>(null);
  const [debugSignature, setDebugSignature] = useState<any>(null);
  const [debugStep, setDebugStep] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    initWasm(API_BASE).catch((e) => setError(String(e)));
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = useCallback(async () => {
    if (!identity) {
      setError("No registered identity on this device. Please register first.");
      return;
    }
    setBusy(true);
    setError(null);
    setDebugChallenge(null);
    setDebugSignature(null);
    
    try {
      // STEP 1 — TOTP
      setDebugStep("🔐 1. Vérification TOTP...");
      const secret = loadTotpDev(identity.totpRef);
      if (!secret) throw new Error("TOTP secret missing on this device.");
      if (!verifyTotp(secret, code, identity.did)) throw new Error("Invalid TOTP code");
      audit("INFO", "TOTP verified");
      send("TOTP_VERIFIED");
      setDebugStep("✅ 1. TOTP vérifié");

      // STEP 2 — Health
      setDebugStep("🏥 2. Vérification backend...");
      await healthCheck();
      send("BACKEND_OK");
      setDebugStep("✅ 2. Backend OK");

      // STEP 3 — Challenge
      setDebugStep("🎲 3. Demande de challenge au backend...");
      send("CHALLENGE_REQUESTED");
      const challenge = await getChallenge("login");
      setDebugChallenge({
        id: challenge.challenge_id,
        nonce: challenge.nonce,
        expires_at: challenge.expires_at,
        expires_date: new Date(challenge.expires_at * 1000).toLocaleString(),
        message: JSON.stringify({ ctx: "login", nonce: challenge.nonce }, null, 2)
      });
      audit("INFO", "Challenge obtained", { challenge_id: challenge.challenge_id });
      send("CHALLENGE_RECEIVED");
      setDebugStep(`✅ 3. Challenge reçu (expire dans ${Math.round((challenge.expires_at - Date.now()/1000))}s)`);

      // STEP 4 — Créer le document à signer
      setDebugStep("📄 4. Création du document à signer...");
      const documentToSign = {
        ctx: "login",
        nonce: challenge.nonce,
        challenge_id: challenge.challenge_id,
        did: identity.did,
        timestamp: Date.now()
      };
      const docB64 = encodeUtf8ToB64(JSON.stringify(documentToSign));
      setDebugStep(`📄 4. Document créé (${docB64.length} caractères base64)`);

      // STEP 5 — Signer
      setDebugStep("✍️ 5. Signature ML-DSA-65 + Ed25519...");
      const sig = await signDocumentWithChallenge(docB64, challenge.challenge_id);
      setDebugSignature({
        id: sig.signature_id,
        algorithm: "ML-DSA-65 + Ed25519",
        timestamp: new Date().toLocaleString(),
        full: sig
      });
      send("SIGNED");
      setDebugStep(`✅ 5. Signature créée: ${sig.signature_id.substring(0, 30)}...`);

      // STEP 6 — Verify
      setDebugStep("🔍 6. Vérification de la signature...");
      const v = await verifySignature(sig.signature_id, docB64);
      if (!v?.valid) throw new Error("Signature verification failed");
      send("VERIFIED");
      setDebugStep("✅ 6. Signature vérifiée avec succès !");

      // STEP 7 — Wallet
      setDebugStep("👛 7. Connexion au wallet...");
      audit("INFO", "Wallet connection requested");
      const eth = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } }).ethereum;
      if (!eth) throw new Error("MetaMask not available");
      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0];
      if (!addr) throw new Error("No wallet account");
      if (addr.toLowerCase() !== identity.walletAddress.toLowerCase())
        throw new Error("Wallet does not match registered identity");
      setWalletAddr(addr);
      audit("SUCCESS", "Wallet connected", { addr });
      send("WALLET_CONNECTED");
      setDebugStep(`✅ 7. Wallet connecté: ${addr.substring(0, 10)}...`);

      // STEP 8 — Grant
      setDebugStep("🎫 8. Finalisation et accès...");
      sessionStorage.setItem(
        "qsdid.session",
        JSON.stringify({ did: identity.did, addr, issuedAt: Date.now() }),
      );
      send("ACCESS_GRANTED");
      audit("SUCCESS", "Access granted", { did: identity.did });
      setDebugStep("✅ 8. Accès accordé ! Redirection...");
      
      toast({ title: "Authenticated", description: identity.did });
      setTimeout(() => navigate("/holder"), 1500);
      
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      setError(msg);
      setDebugStep(`❌ ERREUR: ${msg}`);
      audit("ERROR", "Login failed", { error: msg });
    } finally {
      setBusy(false);
    }
  }, [identity, code, send, navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(hsl(var(--primary)/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Panneau principal */}
        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-lg backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold text-foreground">Sign in with PQC</h1>
            </div>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Toggle Debug Mode"
            >
              <Bug className="h-4 w-4" />
            </button>
          </div>
          
          <p className="mt-1 text-xs text-muted-foreground">
            Enter your authenticator code. Your wallet will be challenged with ML-DSA-65.
          </p>

          {!identity && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              No identity on this device. <button className="underline" onClick={() => navigate("/onboarding")}>Register</button>.
            </div>
          )}

          {identity && (
            <>
              <label className="mt-5 block text-xs font-medium text-foreground">6-digit code</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                className="mt-1 tracking-[0.4em] text-center font-mono"
              />

              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                <KeyRound className="h-3 w-3" /> State: <span className="font-mono text-foreground">{state}</span>
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button onClick={handleVerify} disabled={busy || code.length !== 6} className="mt-4 w-full">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
                Verify & Sign
              </Button>

              {walletAddr && (
                <p className="mt-3 break-all text-center font-mono text-[10px] text-muted-foreground">{walletAddr}</p>
              )}
            </>
          )}
        </div>

        {/* Panneau de DEBUG */}
        {showDebug && (debugStep || debugChallenge || debugSignature) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl border border-cyan-500/30 bg-gray-950/90 p-4 font-mono text-xs backdrop-blur-xl"
          >
            <div className="mb-3 flex items-center justify-between border-b border-cyan-500/30 pb-2">
              <span className="text-cyan-400 font-bold">🔧 DEV MODE - Processus Post-Quantum</span>
              <span className="text-[9px] text-gray-500">ML-DSA-65 + Ed25519</span>
            </div>
            
            {/* Étape actuelle */}
            <div className="mb-3 rounded-md bg-gray-900/50 p-2">
              <span className="text-yellow-400">📌 Étape:</span>
              <span className="ml-2 text-gray-300">{debugStep}</span>
            </div>
            
            {/* Challenge */}
            {debugChallenge && (
              <div className="mb-3 rounded-md bg-gray-900/50 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-green-400">🎲 Challenge reçu</span>
                  <button
                    onClick={() => copyToClipboard(debugChallenge.nonce)}
                    className="flex items-center gap-1 rounded bg-gray-800 px-1.5 py-0.5 text-[9px] hover:bg-gray-700"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </button>
                </div>
                <div className="mt-1 ml-2 text-gray-400 space-y-0.5">
                  <div><span className="text-gray-500">ID:</span> {debugChallenge.id}</div>
                  <div><span className="text-gray-500">Nonce:</span> <span className="font-mono break-all">{debugChallenge.nonce}</span></div>
                  <div><span className="text-gray-500">Expire:</span> {debugChallenge.expires_date}</div>
                  <div className="mt-1 text-[9px] text-gray-500">
                    Message à signer: {"{"}"ctx":"login","nonce":"{debugChallenge.nonce.substring(0, 20)}..."{"}"}
                  </div>
                </div>
              </div>
            )}
            
            {/* Signature */}
            {debugSignature && (
              <div className="mb-3 rounded-md bg-gray-900/50 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-purple-400">✍️ Signature créée</span>
                  <span className="text-[9px] text-green-400">✓ VALIDE</span>
                </div>
                <div className="mt-1 ml-2 text-gray-400 space-y-0.5">
                  <div><span className="text-gray-500">ID:</span> <span className="font-mono break-all">{debugSignature.id}</span></div>
                  <div><span className="text-gray-500">Algorithmes:</span> {debugSignature.algorithm}</div>
                  <div><span className="text-gray-500">Heure:</span> {debugSignature.timestamp}</div>
                  <div className="mt-1 text-[9px] text-cyan-400">
                    ✓ Signature vérifiée avec succès par le backend
                  </div>
                </div>
              </div>
            )}
            
            {/* Légende */}
            <div className="mt-2 text-[9px] text-gray-500 border-t border-gray-800 pt-2">
              <div>🔐 TOTP = Authentification à deux facteurs</div>
              <div>🎲 Challenge = Défi unique (anti-rejeu)</div>
              <div>✍️ ML-DSA-65 = Signature post-quantique</div>
              <div>🔍 Vérification = Backend valide la signature</div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
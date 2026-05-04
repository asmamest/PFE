import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, KeyRound, Wallet, AlertTriangle, Bug, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useAuthMachine } from "@/lib/qsdid/stateMachine";
import { audit } from "@/lib/qsdid/audit";
import { fetchFromIPFS } from "@/lib/ipfs/ipfsClient";
import {
  initWasm,
  healthCheck,
  getChallenge,
  verifySignature,
  encodeUtf8ToB64,
} from "@/lib/qsdid/wasmClient";
import { loadEncryptedMLDSAKey } from "@/lib/secureStorage";
import { getPRFKey } from "@/lib/webauthnPrf";
import { decryptWithPRF } from "@/lib/cryptoWrapper";
import { ethers } from "ethers";
import { USER_REGISTRY_ADDRESS } from "@/lib/blockchain/constants";
import userRegistryAbi from "@/lib/blockchain/UserRegistryAbi.json";

const API_BASE = "http://localhost:8083";

type Identity = {
  did: string;
  walletAddress: string;
  totpRef: string;
  publicKey?: string;
  role: "holder" | "issuer"; // Ajout du rôle
};

async function loadIdentityFromBlockchain(walletAddress: string): Promise<Identity | null> {
  try {
    if (!window.ethereum) throw new Error("MetaMask not available");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const contract = new ethers.Contract(USER_REGISTRY_ADDRESS, userRegistryAbi, provider);
    const user = await contract.getUser(walletAddress);
    if (!user || !user.active) return null;

    const cid = user.metadataCID;
    const didDoc = await fetchFromIPFS(cid);
    const publicKeyMultibase = didDoc.verificationMethod?.[0]?.publicKeyMultibase || "";

    // Déterminer le rôle à partir du bitmask (1 = issuer, 2 = holder)
    const rolesMask = Number(user.roles);
    let userRole: "holder" | "issuer" | null = null;
    if (rolesMask & 1) userRole = "issuer";
    else if (rolesMask & 2) userRole = "holder";
    if (!userRole) return null;

    return {
      did: `did:zk:${walletAddress}`,
      walletAddress,
      totpRef: `did:zk:${walletAddress}`,
      publicKey: publicKeyMultibase,
      role: userRole,
    };
  } catch (err) {
    console.error("loadIdentityFromBlockchain error:", err);
    return null;
  }
}

export default function Login() {
  const navigate = useNavigate();
  const { state, send } = useAuthMachine();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loadingIdentity, setLoadingIdentity] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddr, setWalletAddr] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugStep, setDebugStep] = useState<string>("");
  const [debugChallenge, setDebugChallenge] = useState<any>(null);
  const [debugSignature, setDebugSignature] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    initWasm(API_BASE).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoadingIdentity(true);
      try {
        if (!window.ethereum) {
          setError("MetaMask not installed. Please install MetaMask.");
          setLoadingIdentity(false);
          return;
        }
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        let addr = accounts?.[0];
        if (!addr) {
          const newAccounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          addr = newAccounts?.[0];
        }
        if (!addr) {
          setError("No wallet account selected.");
          setLoadingIdentity(false);
          return;
        }
        setWalletAddr(addr);
        const id = await loadIdentityFromBlockchain(addr);
        if (!id) {
          setError("No identity found for this wallet. Please complete onboarding first.");
          setLoadingIdentity(false);
          return;
        }
        setIdentity(id);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoadingIdentity(false);
      }
    };
    load();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = useCallback(async () => {
    if (!identity) {
      setError("No identity loaded.");
      return;
    }
    setBusy(true);
    setError(null);
    setDebugChallenge(null);
    setDebugSignature(null);

    try {
      setDebugStep("🔐 1. Vérification TOTP...");
      const verifyRes = await fetch("http://localhost:8083/api/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: identity.did, token: code }),
      });
      if (!verifyRes.ok) {
        const errData = await verifyRes.json();
        throw new Error(errData.error || "Invalid TOTP code");
      }
      audit("INFO", "TOTP verified");
      send("TOTP_VERIFIED");
      setDebugStep("✅ 1. TOTP vérifié");

      setDebugStep("🏥 2. Vérification backend...");
      await healthCheck();
      send("BACKEND_OK");
      setDebugStep("✅ 2. Backend OK");

      setDebugStep("📦 3. Chargement de la clé privée chiffrée (IndexedDB)...");
      const encryptedData = await loadEncryptedMLDSAKey(identity.walletAddress);
      if (!encryptedData) {
        throw new Error("Clé privée chiffrée introuvable. Veuillez refaire l'onboarding.");
      }
      setDebugStep(`✅ 3. Clé chargée (credentialId: ${encryptedData.credentialId.slice(0, 16)}...)`);

      setDebugStep("🔄 4. Validation biométrique (PRF)...");
      const prfKey = await getPRFKey(encryptedData.credentialId);
      if (!(prfKey instanceof CryptoKey)) {
        throw new Error("La clé PRF n'est pas valide");
      }
      setDebugStep("✅ 4. Clé PRF obtenue (biométrie validée)");

      setDebugStep("🔓 5. Déchiffrement des clés privées et publiques...");
      const decryptedJson = await decryptWithPRF(prfKey, encryptedData.ciphertext, encryptedData.iv);
      if (!decryptedJson) throw new Error("Échec du déchiffrement");
      const keys = JSON.parse(decryptedJson);
      const pq_secret = keys.pq_secret;
      const classical_secret = keys.classical_secret;
      const pq_public = keys.pq_public;
      const classical_public = keys.classical_public;
      if (!pq_secret || !classical_secret || !pq_public || !classical_public) {
        throw new Error("Données de clés incomplètes dans le bundle. Veuillez refaire l'onboarding avec la version corrigée.");
      }
      setDebugStep("✅ 5. Clés déchiffrées (privées + publiques)");

      setDebugStep("🎲 6. Demande de challenge...");
      send("CHALLENGE_REQUESTED");
      const challenge = await getChallenge("login");
      setDebugChallenge({
        id: challenge.challenge_id,
        nonce: challenge.nonce,
        expires_at: challenge.expires_at,
        expires_date: new Date(challenge.expires_at * 1000).toLocaleString(),
      });
      send("CHALLENGE_RECEIVED");
      setDebugStep(`✅ 6. Challenge reçu (expire dans ${Math.round((challenge.expires_at - Date.now() / 1000))}s)`);

      const docToSign = {
        ctx: "login",
        nonce: challenge.nonce,
        challenge_id: challenge.challenge_id,
        did: identity.did,
        timestamp: Date.now(),
      };
      const docB64 = encodeUtf8ToB64(JSON.stringify(docToSign));

      setDebugStep("✍️ 7. Signature ML-DSA (via backend)...");
      const signResponse = await fetch(`${API_BASE}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: docB64,
          challenge_id: challenge.challenge_id,
          private_key: {
            pq_secret,
            classical_secret,
            pq_public,
            classical_public,
          }
        })
      });
      if (!signResponse.ok) {
        const errText = await signResponse.text();
        throw new Error(`Signing failed: ${errText}`);
      }
      const sig = await signResponse.json();
      setDebugSignature({
        id: sig.signature_id,
        algorithm: "ML-DSA-65",
        timestamp: new Date().toLocaleString(),
      });
      send("SIGNED");
      setDebugStep(`✅ 7. Signature créée: ${sig.signature_id.substring(0, 30)}...`);

      setDebugStep("🔍 8. Vérification de la signature...");
      const v = await verifySignature(sig.signature_id, docB64);
      if (!v?.valid) throw new Error("Signature verification failed");
      send("VERIFIED");
      setDebugStep("✅ 8. Signature vérifiée");

      setDebugStep("👛 9. Connexion au wallet...");
      if (!window.ethereum) throw new Error("MetaMask not available");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0];
      if (!addr) throw new Error("No wallet account");
      if (addr.toLowerCase() !== identity.walletAddress.toLowerCase())
        throw new Error("Wallet does not match registered identity");
      setWalletAddr(addr);
      send("WALLET_CONNECTED");
      setDebugStep(`✅ 9. Wallet connecté: ${addr.substring(0, 10)}...`);

      send("ACCESS_GRANTED");
      audit("SUCCESS", "Access granted", { did: identity.did });
      setDebugStep("✅ 10. Accès accordé ! Redirection...");
      toast({ title: "Authenticated", description: identity.did });

      // Redirection selon le rôle
      if (identity.role === "holder") {
        setTimeout(() => navigate("/holder"), 1500);
      } else {
        setTimeout(() => navigate("/issuer/dashboard"), 1500);
      }
    } catch (err: any) {
      const msg = err.message;
      setError(msg);
      setDebugStep(`❌ ERREUR: ${msg}`);
      audit("ERROR", "Login failed", { error: msg });
    } finally {
      setBusy(false);
    }
  }, [identity, code, send, navigate]);

  if (loadingIdentity) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-lg font-semibold">No Identity Found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "Please complete onboarding first."}
          </p>
          <Button className="mt-4" onClick={() => navigate("/onboarding")}>
            Go to Onboarding
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-lg backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold text-foreground">Sign in with PQC</h1>
            </div>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Bug className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter your authenticator code. Your wallet will be challenged with ML-DSA-65.
          </p>

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
            <span className="mx-1">•</span>
            <Wallet className="h-3 w-3" /> {identity.walletAddress.slice(0, 10)}...
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
        </div>

        {showDebug && (
          <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-gray-950/90 p-4 font-mono text-xs backdrop-blur-xl">
            <div className="mb-2 border-b border-cyan-500/30 pb-1 text-cyan-400">🔧 Processus</div>
            <div className="mb-2 text-gray-300">{debugStep || "En attente..."}</div>
            {debugChallenge && (
              <div className="mb-2 rounded bg-gray-900/50 p-2">
                <div className="text-green-400">🎲 Challenge ID: {debugChallenge.id}</div>
                <div className="break-all text-gray-400">Nonce: {debugChallenge.nonce}</div>
              </div>
            )}
            {debugSignature && (
              <div className="rounded bg-gray-900/50 p-2">
                <div className="text-purple-400">✍️ Signature ID: {debugSignature.id}</div>
                <div className="text-gray-500">Algo: {debugSignature.algorithm}</div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  Check,
  X,
  FileUp,
  Loader2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Wallet,
  Fingerprint,
  Copy,
  CheckCheck,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { truncateMiddle, formatDate, formatDateTime, copyToClipboard } from "@/lib/issuer-utils";

export interface CredentialRequest {
  id: string;
  holder: string;
  credentialType: string;
  requestedAt: number;
  message?: string;
  holderDid?: string;
  holderName?: string;
  holderPublicKey?: string;
}

interface Props {
  requests: CredentialRequest[];
  onIssue: (
    req: CredentialRequest,
    expiration: number | null,
    document: File,
    claims: Record<string, any>,
    score: number ,
    
  ) => Promise<void>;
  onReject: (req: CredentialRequest, reason: string) => void;
  issuerAddress: string;
}

type Mode = "list" | "accept" | "reject";

export function PendingRequests({ requests, onIssue, onReject,issuerAddress }: Props) {
  const [selected, setSelected] = useState<CredentialRequest | null>(null);
  const [mode, setMode] = useState<Mode>("list");
  const [search, setSearch] = useState("");

  const filtered = requests.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.holder.toLowerCase().includes(q) ||
      (r.holderName?.toLowerCase().includes(q) ?? false) ||
      (r.holderDid?.toLowerCase().includes(q) ?? false) ||
      r.credentialType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-warning" />
          <h3 className="text-sm font-semibold text-foreground">Demandes en attente</h3>
          <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
            {requests.length}
          </span>
        </div>
      </div>

      {requests.length > 0 && (
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par holder, nom, DID, type…"
              className="pl-7 text-xs"
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            {requests.length === 0 ? "Aucune demande en attente" : "Aucun résultat"}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((req) => (
            <li key={req.id}>
              <button
                onClick={() => {
                  setSelected(req);
                  setMode("list");
                }}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{req.credentialType}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {req.holderName ? `${req.holderName} (${truncateMiddle(req.holder)})` : truncateMiddle(req.holder)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDate(req.requestedAt)}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {selected && (
          <RequestDialog
            req={selected}
            mode={mode}
            setMode={setMode}
            onClose={() => setSelected(null)}
            onIssue={async (exp, file, claims, score) => {
              await onIssue(selected, exp, file, claims, score);
              setSelected(null);
            }}
            onReject={(reason) => {
              onReject(selected, reason);
              setSelected(null);
              toast.success("Demande refusée");
            }}
            issuerAddress={issuerAddress} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RequestDialog({
  req,
  mode,
  setMode,
  onClose,
  onIssue,
  onReject,
  issuerAddress,
}: {
  req: CredentialRequest;
  mode: Mode;
  setMode: (m: Mode) => void;
  onClose: () => void;
  onIssue: (exp: number | null, file: File, claims: Record<string, any>, score: number) => Promise<void>;
  onReject: (reason: string) => void;
  issuerAddress: string; 
}) {
  const [expiration, setExpiration] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [edgeState, setEdgeState] = useState<"idle" | "analyzing" | "authentic" | "forged">("idle");
  const [edgeScore, setEdgeScore] = useState<number | null>(null);
  const [extractedClaims, setExtractedClaims] = useState<Record<string, any> | null>(null);
  const [validated, setValidated] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [reason, setReason] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [localizationMapBase64, setLocalizationMapBase64] = useState<string | null>(null);

  const recordFailedAttempt = async () => {
    try {
      const res = await fetch("http://localhost:8083/record-failed-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issuer: issuerAddress }),
      });
      const data = await res.json();
      if (data.banned) {
        toast.error("Vous avez été banni pour 3 tentatives frauduleuses.");
        setTimeout(() => window.location.href = "/login", 3000);
      } else {
        toast.warning(`Tentative frauduleuse enregistrée (${data.totalFails}/3).`);
      }
    } catch (err) {
      console.error("Failed to record attempt:", err);
    }
  };

  // Appel réel à EdgeDoc (microservice)
  const runEdgeDoc = async () => {
    if (!file) return;
    setEdgeState("analyzing");
    const formData = new FormData();
    formData.append("document", file);
    try {
      const res = await fetch("http://localhost:8085/edgedoc/analyze", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.localizationMap) setLocalizationMapBase64(data.localizationMap);
      // data doit contenir: { authentic: boolean, score: number, localizationMap: string (CID ou base64) }
      setEdgeScore(data.score);
      if (data.authentic) {
        setEdgeState("authentic");
        setEdgeScore(data.score);
        toast.success("Document authentifié par EdgeDoc");
        extractClaims(file);  // plus de localizationMap
      } else {
        setEdgeState("forged");
        toast.error("EdgeDoc : manipulation détectée, émission impossible");
        // Appel backend pour enregistrer la tentative frauduleuse
        await recordFailedAttempt();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'analyse EdgeDoc");
      setEdgeState("idle");
    }
  };



  // Extraction des champs via LLM

  const extractClaims = async (file: File) => {
    setExtracting(true);
    const formData = new FormData();
    formData.append("document", file);
    try {
      const res = await fetch("http://localhost:8085/extract", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Extraction failed: ${res.status}`);
      const result = await res.json();
      if (result.success && result.data) {
        // Aplatir l'objet imbriqué
        const flattenObject = (obj: any, parentKey = ""): Record<string, any> => {
          let flat: Record<string, any> = {};
          for (const [key, value] of Object.entries(obj)) {
            const newKey = parentKey ? `${parentKey}_${key}` : key;
            if (value && typeof value === "object" && !Array.isArray(value)) {
              flat = { ...flat, ...flattenObject(value, newKey) };
            } else {
              flat[newKey] = value;
            }
          }
          return flat;
        };
        const flatClaims = flattenObject(result.data);
        setExtractedClaims(flatClaims);
        toast.success("Champs extraits avec succès");
      } else {
        throw new Error("Extraction failed: invalid response");
      }
    } catch (err) {
      console.error(err);
      toast.error("Échec de l'extraction des champs");
      setEdgeState("idle");
    } finally {
      setExtracting(false);
    }
  };


  const handleIssue = async () => {
    if (!file || edgeState !== "authentic" || !extractedClaims || !validated) return;
    setIssuing(true);
    try {
      const exp = expiration ? new Date(expiration).getTime() : null;
      await onIssue(exp, file, extractedClaims, edgeScore!);
    } catch (err) {
      toast.error("Erreur lors de l'émission");
    } finally {
      setIssuing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setEdgeState("idle");
    setExtractedClaims(null);
    setValidated(false);
    setExpiration("");
    setEdgeScore(null);
    setExtracting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">{req.credentialType}</h3>
            {req.holderName && (
              <p className="mt-0.5 text-xs text-foreground/80">{req.holderName}</p>
            )}
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Demandé le {formatDateTime(req.requestedAt)}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Holder metadata */}
        <div className="mb-3 space-y-1.5 rounded-lg border border-border bg-secondary/30 p-3">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Identité du holder
          </p>
          <MetaRow icon={<Wallet className="h-3 w-3" />} label="Wallet" value={req.holder} />
          {req.holderDid && (
            <MetaRow icon={<Fingerprint className="h-3 w-3" />} label="DID" value={req.holderDid} />
          )}
        </div>

        {req.message && (
          <div className="mb-3 rounded-md bg-secondary/40 p-2 text-xs text-foreground">
            <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Message du holder
            </p>
            {req.message}
          </div>
        )}

        {mode === "list" && (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setMode("accept")} size="sm" className="bg-success text-success-foreground hover:bg-success/90">
              <Check className="h-3.5 w-3.5" /> Accepter
            </Button>
            <Button onClick={() => setMode("reject")} size="sm" variant="destructive">
              <X className="h-3.5 w-3.5" /> Refuser
            </Button>
          </div>
        )}

        {mode === "accept" && (
          <div className="space-y-3">
            {/* Expiration */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Date d'expiration (optionnel)
              </label>
              <Input
                type="date"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Upload du document */}
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Document à signer
              </label>
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
                <FileUp className="h-3.5 w-3.5" />
                {file ? file.name : "Uploader le document (PDF, image)"}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    if (f) {
                      // Reset des états
                      setEdgeState("idle");
                      setExtractedClaims(null);
                      setValidated(false);
                      setEdgeScore(null);
                      setExtracting(false);
                    }
                  }}
                />
              </label>
            </div>

            {/* Bouton EdgeDoc (disponible si fichier uploade et état idle) */}
            {file && edgeState === "idle" && (
              <Button onClick={runEdgeDoc} size="sm" variant="outline" className="w-full">
                <ShieldCheck className="h-3.5 w-3.5" /> Analyser avec EdgeDoc
              </Button>
            )}

            {/* Analyse en cours */}
            {edgeState === "analyzing" && (
              <div className="flex items-center justify-center gap-2 rounded-md bg-primary/5 py-2 text-xs text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyse EdgeDoc en cours…
              </div>
            )}

            {/* Document authentique */}
            {edgeState === "authentic" && !extractedClaims && extracting && (
              <div className="flex items-center justify-center gap-2 rounded-md bg-primary/5 py-2 text-xs text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Extraction des champs…
              </div>
            )}

            {edgeState === "authentic" && extractedClaims && (
              <div className="rounded-md bg-secondary/30 p-3 text-sm space-y-2">
                <p className="font-semibold text-xs">Champs extraits du document (authentifié) :</p>
                {Object.entries(extractedClaims).map(([key, value]) => (
                  <div key={key} className="flex justify-between border-b border-border/40 py-1">
                    <span className="capitalize">{key}:</span>
                    <span className="font-mono text-xs">{String(value)}</span>
                  </div>
                ))}
                {edgeScore !== null && (
                  <p className="text-[10px] text-muted-foreground mt-2">Score EdgeDoc : {(edgeScore * 100).toFixed(1)}%</p>
                )}
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={validated}
                    onChange={(e) => setValidated(e.target.checked)}
                  />
                  <span className="text-xs">Je confirme que ces informations sont correctes</span>
                </label>
              </div>
            )}

            {localizationMapBase64 && (
              <div className="rounded-md bg-secondary/20 p-2 text-center">
                <p className="text-[9px] text-muted-foreground mb-1">Carte de localisation (visualisation seule)</p>
                <img src={`data:image/png;base64,${localizationMapBase64}`} alt="Localisation" className="max-h-32 mx-auto" />
              </div>
            )}

            {/* Document falsifié */}
            {edgeState === "forged" && (
              <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
                ⚠️ Le document semble falsifié. Émission bloquée.
              </div>
            )}

            {/* Bouton d'émission */}
            <Button
              onClick={handleIssue}
              disabled={
                edgeState !== "authentic" ||
                !extractedClaims ||
                !validated ||
                issuing
              }
              size="sm"
              className="w-full"
            >
              {issuing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Signature & émission…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" /> Émettre le credential
                </>
              )}
            </Button>
          </div>
        )}

        {mode === "reject" && (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Motif du refus (obligatoire)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Justification du refus…"
                className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-xs"
              />
            </div>
            <Button
              onClick={() => onReject(reason)}
              disabled={!reason.trim()}
              size="sm"
              variant="destructive"
              className="w-full"
            >
              Confirmer le refus
            </Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (await copyToClipboard(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };
  return (
    <button
      onClick={onCopy}
      title={`Copier ${value}`}
      className="group flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-background/60"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="w-12 shrink-0 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="flex-1 truncate font-mono text-[10px] text-foreground">{value}</span>
      {copied ? (
        <CheckCheck className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}
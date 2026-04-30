import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  User,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Globe,
  Mail,
  MapPin,
  Hash,
  Tag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AccountType = "individual" | "organization";

interface IssuerFormData {
  legalName: string;
  registrationNumber: string;
  postalAddress: string;
  country: string;
  contactEmail: string;
  credentialTypes: string[];
  credibilityFile: File | null;
}

interface VerificationResult {
  score: number;
  verified: boolean;
  tag: string;
  message: string;
}

interface IssuerRegistrationFormProps {
  accountType: AccountType;
  walletAddress: string;
  onComplete: (data: { formData: IssuerFormData; verificationTag: string; cid: string }) => void;
  onBack?: () => void;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3 },
};

export default function IssuerRegistrationForm({
  accountType,
  walletAddress,
  onComplete,
  onBack,
}: IssuerRegistrationFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<IssuerFormData>({
    legalName: "",
    registrationNumber: "",
    postalAddress: "",
    country: "",
    contactEmail: "",
    credentialTypes: [],
    credibilityFile: null,
  });

  const [step, setStep] = useState<"form" | "verifying" | "result">("form");
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof IssuerFormData, string>>>({});

  const isOrg = accountType === "organization";

  const [credentialInput, setCredentialInput] = useState("");

  const updateField = useCallback(
    <K extends keyof IssuerFormData>(key: K, value: IssuerFormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    [],
  );

  const addCredentialType = useCallback((type: string) => {
    const trimmed = type.trim();
    if (!trimmed) return;
    setFormData((prev) => {
      if (prev.credentialTypes.includes(trimmed)) return prev;
      return { ...prev, credentialTypes: [...prev.credentialTypes, trimmed] };
    });
    setCredentialInput("");
    setErrors((prev) => ({ ...prev, credentialTypes: undefined }));
  }, []);

  const removeCredentialType = useCallback((type: string) => {
    setFormData((prev) => ({
      ...prev,
      credentialTypes: prev.credentialTypes.filter((t) => t !== type),
    }));
  }, []);

  const validate = useCallback((): boolean => {
    const errs: Partial<Record<keyof IssuerFormData, string>> = {};
    if (!formData.legalName.trim()) errs.legalName = "Requis";
    if (!formData.registrationNumber.trim()) errs.registrationNumber = "Requis";
    if (!formData.postalAddress.trim()) errs.postalAddress = "Requis";
    if (!formData.country.trim()) errs.country = "Requis";
    if (!formData.contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail))
      errs.contactEmail = "Email valide requis";
    if (formData.credentialTypes.length === 0)
      errs.credentialTypes = "Sélectionnez au moins un type";
    if (!formData.credibilityFile)
      errs.credibilityFile = "Justificatif requis";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [formData]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        setErrors((prev) => ({ ...prev, credibilityFile: "Fichier trop volumineux (max 10 Mo)" }));
        return;
      }
      const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
      if (!validTypes.includes(file.type)) {
        setErrors((prev) => ({ ...prev, credibilityFile: "Format accepté : PDF, PNG, JPEG" }));
        return;
      }
      updateField("credibilityFile", file);
    },
    [updateField],
  );

  // Simulation de EdgeDoc AI – à remplacer par un vrai appel API
  const simulateEdgeDocVerification = useCallback(async (): Promise<VerificationResult> => {
    await new Promise((r) => setTimeout(r, 3000));
    const score = Math.random() * 0.3; // bias toward authentic
    const verified = score < 0.2;
    return {
      score,
      verified,
      tag: verified ? `edgedoc:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}` : "",
      message: verified
        ? "Document authentifié avec succès. Score de confiance élevé."
        : "Le document présente des anomalies. Veuillez soumettre un autre justificatif.",
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    setStep("verifying");

    try {
      const result = await simulateEdgeDocVerification();
      setVerification(result);
      setStep("result");

      if (result.verified) {
        // Simuler upload IPFS et obtention d'un CID
        const fakeCid = `Qm${Math.random().toString(36).slice(2, 15)}${Math.random().toString(36).slice(2, 15)}`;
        setTimeout(() => {
          onComplete({
            formData,
            verificationTag: result.tag,
            cid: fakeCid,
          });
        }, 2000);
      }
    } catch {
      setVerification({
        score: 1,
        verified: false,
        tag: "",
        message: "Erreur lors de la vérification. Veuillez réessayer.",
      });
      setStep("result");
    }
  }, [validate, simulateEdgeDocVerification, onComplete, formData]);

  const resetToForm = useCallback(() => {
    setStep("form");
    setVerification(null);
    updateField("credibilityFile", null);
  }, [updateField]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <motion.div {...fadeIn} className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 glow-primary">
          {isOrg ? (
            <Building2 className="h-6 w-6 text-primary" />
          ) : (
            <User className="h-6 w-6 text-primary" />
          )}
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Enregistrement {isOrg ? "Organisation" : "Individu"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Informations requises pour l'émission de credentials vérifiables
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[10px] font-mono text-muted-foreground">
          <Shield className="h-3 w-3" />
          {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ── FORM STEP ── */}
        {step === "form" && (
          <motion.div key="form" {...fadeIn} className="space-y-4">
            {/* Legal name */}
            <FieldGroup
              icon={<User className="h-3.5 w-3.5" />}
              label={isOrg ? "Nom légal de l'organisation" : "Nom complet"}
              error={errors.legalName}
            >
              <Input
                value={formData.legalName}
                onChange={(e) => updateField("legalName", e.target.value)}
                placeholder={isOrg ? "Acme Corp SAS" : "Jean Dupont"}
                className="bg-surface border-border"
              />
            </FieldGroup>

            {/* Registration number */}
            <FieldGroup
              icon={<Hash className="h-3.5 w-3.5" />}
              label={isOrg ? "Numéro SIRET / TVA" : "Numéro d'identification nationale"}
              error={errors.registrationNumber}
            >
              <Input
                value={formData.registrationNumber}
                onChange={(e) => updateField("registrationNumber", e.target.value)}
                placeholder={isOrg ? "123 456 789 00012" : "99 01 23 456 789 01"}
                className="bg-surface border-border font-mono"
              />
            </FieldGroup>

            {/* Address + Country row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldGroup
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Adresse postale"
                error={errors.postalAddress}
              >
                <Input
                  value={formData.postalAddress}
                  onChange={(e) => updateField("postalAddress", e.target.value)}
                  placeholder="12 rue de la Paix, 75002 Paris"
                  className="bg-surface border-border"
                />
              </FieldGroup>

              <FieldGroup
                icon={<Globe className="h-3.5 w-3.5" />}
                label="Pays"
                error={errors.country}
              >
                <Input
                  value={formData.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  placeholder="France"
                  className="bg-surface border-border"
                />
              </FieldGroup>
            </div>

            {/* Email */}
            <FieldGroup
              icon={<Mail className="h-3.5 w-3.5" />}
              label="Email de contact"
              error={errors.contactEmail}
            >
              <Input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => updateField("contactEmail", e.target.value)}
                placeholder="contact@acme.com"
                className="bg-surface border-border"
              />
            </FieldGroup>

            {/* Credential types */}
            <FieldGroup
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Types de credentials émis"
              error={errors.credentialTypes}
            >
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={credentialInput}
                    onChange={(e) => setCredentialInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCredentialType(credentialInput);
                      }
                    }}
                    placeholder="Ex : Diplôme universitaire, Certification pro…"
                    className="bg-surface border-border flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addCredentialType(credentialInput)}
                    className="text-[11px] shrink-0"
                  >
                    Ajouter
                  </Button>
                </div>
                {formData.credentialTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formData.credentialTypes.map((type) => (
                      <span
                        key={type}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                      >
                        {type}
                        <button
                          type="button"
                          onClick={() => removeCredentialType(type)}
                          className="hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </FieldGroup>

            {/* File upload */}
            <FieldGroup
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Justificatif de crédibilité"
              hint={isOrg ? "KBIS, extrait d'immatriculation" : "Carte d'identité professionnelle, CNI"}
              error={errors.credibilityFile}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />

              {formData.credibilityFile ? (
                <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {formData.credibilityFile.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(formData.credibilityFile.size / 1024).toFixed(0)} Ko
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateField("credibilityFile", null)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface/50 px-4 py-6 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Glissez ou cliquez pour uploader
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    PDF, PNG, JPEG · Max 10 Mo
                  </span>
                </button>
              )}
            </FieldGroup>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              {onBack && (
                <Button variant="outline" onClick={onBack} className="text-xs">
                  Retour
                </Button>
              )}
              <Button onClick={handleSubmit} className="flex-1 text-xs gap-2">
                <Shield className="h-3.5 w-3.5" />
                Soumettre & vérifier le justificatif
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── VERIFYING STEP ── */}
        {step === "verifying" && (
          <motion.div key="verifying" {...fadeIn} className="flex flex-col items-center gap-6 py-12">
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center glow-primary">
                <Shield className="h-8 w-8 text-primary animate-pulse-glow" />
              </div>
              <Loader2 className="absolute -top-2 -right-2 h-6 w-6 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-semibold text-foreground">Vérification EdgeDoc</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Analyse IA du justificatif en cours…
              </p>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1.5 w-8 rounded-full bg-primary/30"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── RESULT STEP ── */}
        {step === "result" && verification && (
          <motion.div key="result" {...fadeIn} className="flex flex-col items-center gap-5 py-8">
            <div
              className={`h-14 w-14 rounded-2xl flex items-center justify-center ${
                verification.verified
                  ? "bg-success/10 glow-success"
                  : "bg-destructive/10 glow-destructive"
              }`}
            >
              {verification.verified ? (
                <CheckCircle2 className="h-7 w-7 text-success" />
              ) : (
                <AlertTriangle className="h-7 w-7 text-destructive" />
              )}
            </div>

            <div className="text-center max-w-sm">
              <h3 className="text-sm font-semibold text-foreground">
                {verification.verified ? "Document authentifié" : "Vérification échouée"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">{verification.message}</p>
            </div>

            {/* Score bar */}
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Score de confiance</span>
                <span className={verification.verified ? "text-success" : "text-destructive"}>
                  {(1 - verification.score).toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary">
                <motion.div
                  className={`h-full rounded-full ${verification.verified ? "bg-success" : "bg-destructive"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(1 - verification.score) * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            {verification.verified && (
              <div className="w-full max-w-xs rounded-lg border border-success/20 bg-success/5 p-3">
                <p className="text-[10px] font-medium text-success mb-1">Tag de vérification</p>
                <p className="text-[10px] font-mono text-muted-foreground break-all">
                  {verification.tag}
                </p>
              </div>
            )}

            {!verification.verified && (
              <Button variant="outline" onClick={resetToForm} className="text-xs gap-2 mt-2">
                <Upload className="h-3.5 w-3.5" />
                Soumettre un autre justificatif
              </Button>
            )}

            {verification.verified && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                Upload IPFS & enregistrement on-chain…
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Reusable field wrapper ── */
function FieldGroup({
  icon,
  label,
  hint,
  error,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-foreground mb-1.5">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-[10px] text-muted-foreground/70">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-[10px] text-destructive flex items-center gap-1">
          <AlertTriangle className="h-2.5 w-2.5" />
          {error}
        </p>
      )}
    </div>
  );
}
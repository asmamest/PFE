// src/pages/Registration.tsx
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Loader2,
  KeyRound,
  AlertTriangle,
  Upload,
  FileCheck,
  ExternalLink,
  Check,
  X,
  Plus,
  Wallet,
  Fingerprint,
  Globe,
  Mail,
  MapPin,
  Calendar,
  Flag,
  Hash,
  Link2,
  FileText,
  BadgeCheck,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import logo from "@/assets/logo.png";

type EntityType = "organization" | "individual";
type RegistrationStep = 1 | 2 | 3 | 4 | 5;

const ACTIVITY_DOMAINS = [
  "Education",
  "Finance",
  "Healthcare",
  "Government",
  "Legal",
  "Technology",
  "Insurance",
  "Real Estate",
  "Supply Chain",
  "Energy",
];

const cardSpring = { type: "spring" as const, stiffness: 120, damping: 14 };

const stepLabels = [
  "Account Type",
  "Information",
  "Key Generation",
  "Identity Verification",
  "Blockchain Registration",
];

export default function Registration() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") as "issuer" | "verifier" | null;
  const walletAddress = searchParams.get("wallet") || "";
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<RegistrationStep>(1);
  const [entityType, setEntityType] = useState<EntityType | null>(null);

  // Org fields
  const [orgName, setOrgName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [postalAddress, setPostalAddress] = useState("");

  // Individual fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("");
  const [indEmail, setIndEmail] = useState("");

  // Common fields
  const [description, setDescription] = useState("");
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Step 3 — Keys
  const [keysGenerated, setKeysGenerated] = useState(false);
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [privateKeyPreview, setPrivateKeyPreview] = useState("");

  // Step 4 — Verification
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "analyzing" | "verified" | "rejected"
  >("idle");
  const [fraudScore, setFraudScore] = useState(0);

  // Step 5 — Blockchain
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const did = `did:zk:${walletAddress}`;
  const progressPercent = (currentStep / 5) * 100;

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const isStep2Valid = () => {
    if (entityType === "organization") {
      return orgName.trim() && country.trim() && orgEmail.trim();
    }
    return firstName.trim() && lastName.trim() && indEmail.trim();
  };

  const handleGenerateKeys = useCallback(async () => {
    setGeneratingKeys(true);
    // Simulate WASM Rust post-quantum key generation
    await new Promise((r) => setTimeout(r, 2500));
    const mockPub = btoa(
      Array.from({ length: 48 }, () => Math.floor(Math.random() * 256).toString(16)).join("")
    );
    const mockPriv =
      Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join("") +
      "..." +
      Array.from({ length: 4 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    setPublicKey(mockPub.slice(0, 64));
    setPrivateKeyPreview(mockPriv);
    setKeysGenerated(true);
    setGeneratingKeys(false);
    toast({ title: "Post-quantum keys generated", description: "CRYSTALS-Dilithium keypair ready." });
  }, []);

  const handleVerificationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVerificationFile(file);
    setVerificationStatus("analyzing");
    setFraudScore(0);

    // Simulate EdgeDoc AI analysis
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((r) => setTimeout(r, 80));
      setFraudScore(i);
    }

    const score = Math.random();
    if (score < 0.85) {
      setVerificationStatus("verified");
      setFraudScore(96);
      toast({ title: "Document verified", description: "EdgeDoc AI: Authentic document detected." });
    } else {
      setVerificationStatus("rejected");
      setFraudScore(34);
      toast({
        title: "Document rejected",
        description: "EdgeDoc AI: Suspicious anomalies detected.",
        variant: "destructive",
      });
    }
  };

  const handleBlockchainSubmit = useCallback(async () => {
    setSubmitting(true);
    // Simulate wallet signature + blockchain transaction
    await new Promise((r) => setTimeout(r, 1500));

    const mockTx =
      "0x" +
      Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    setTxHash(mockTx);

    await new Promise((r) => setTimeout(r, 2000));
    setRegistered(true);
    setSubmitting(false);
    toast({
      title: "Registration confirmed",
      description: `${role === "issuer" ? "IssuerRegistry" : "VerifierRegistry"}.register() — Success`,
    });
  }, [role]);

  const goNext = () => setCurrentStep((s) => Math.min(s + 1, 5) as RegistrationStep);
  const goBack = () => setCurrentStep((s) => Math.max(s - 1, 1) as RegistrationStep);

  if (!role || !walletAddress) {
    navigate("/onboarding");
    return null;
  }

  const roleLabel = role === "issuer" ? "Issuer" : "Verifier";
  const contractName = role === "issuer" ? "IssuerRegistry" : "VerifierRegistry";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 sm:px-6 py-8">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(hsl(var(--primary)/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/4 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-primary/5 blur-[100px]" />

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={cardSpring}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="rounded-2xl border border-border/60 bg-card/80 shadow-lg backdrop-blur-xl">
          {/* Header */}
          <div className="flex flex-col items-center gap-2 border-b border-border/40 px-6 pt-6 pb-4">
            <div className="flex items-center gap-2">
              <img src={logo} alt="QS·DID" className="h-8 w-8" />
              <span className="text-lg font-bold tracking-tight text-foreground">
                QS<span className="text-primary">·</span>DID
              </span>
            </div>
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
              {roleLabel} Registration
            </p>
          </div>

          {/* Progress */}
          <div className="px-6 pt-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Step {currentStep} of 5
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {stepLabels[currentStep - 1]}
              </span>
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </div>

          {/* Steps Content */}
          <div className="px-6 py-5 min-h-[340px]">
            <AnimatePresence mode="wait">
              {/* Step 1: Entity Type */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ x: 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -60, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <h2 className="text-base font-semibold text-foreground">
                    What type of {roleLabel.toLowerCase()} are you?
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose whether you are registering as an organization or individual.
                  </p>

                  <div className="mt-5 flex flex-col gap-3">
                    {[
                      {
                        id: "organization" as EntityType,
                        name: "Organization",
                        desc: "Company, university, government agency, or other legal entity.",
                        icon: <Building2 className="h-5 w-5" />,
                      },
                      {
                        id: "individual" as EntityType,
                        name: "Individual",
                        desc: "Independent professional or personal registration.",
                        icon: <User className="h-5 w-5" />,
                      },
                    ].map((opt) => {
                      const isSelected = entityType === opt.id;
                      return (
                        <motion.button
                          key={opt.id}
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setEntityType(opt.id)}
                          className={`group flex items-center gap-3 rounded-xl border px-4 py-4 text-left transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                              : "border-border/60 bg-background hover:border-primary/30"
                          }`}
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {opt.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-foreground">{opt.name}</span>
                            <span className="block text-xs text-muted-foreground leading-snug mt-0.5">
                              {opt.desc}
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  <Button
                    onClick={goNext}
                    disabled={!entityType}
                    className="mt-5 w-full"
                    size="lg"
                  >
                    Continue
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </motion.div>
              )}

              {/* Step 2: Registration Form */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ x: 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -60, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <button
                    onClick={goBack}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back
                  </button>

                  <h2 className="text-base font-semibold text-foreground">
                    {entityType === "organization" ? "Organization Details" : "Personal Details"}
                  </h2>

                  {entityType === "organization" ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Building2 className="h-3 w-3" /> Legal Name *
                        </Label>
                        <Input
                          value={orgName}
                          onChange={(e) => setOrgName(e.target.value)}
                          placeholder="Acme Corporation"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Hash className="h-3 w-3" /> Registration Number (SIRET, VAT…)
                        </Label>
                        <Input
                          value={regNumber}
                          onChange={(e) => setRegNumber(e.target.value)}
                          placeholder="Optional"
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Globe className="h-3 w-3" /> Country *
                          </Label>
                          <Input
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            placeholder="France"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Link2 className="h-3 w-3" /> Website
                          </Label>
                          <Input
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://..."
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Mail className="h-3 w-3" /> Contact Email *
                        </Label>
                        <Input
                          type="email"
                          value={orgEmail}
                          onChange={(e) => setOrgEmail(e.target.value)}
                          placeholder="contact@acme.com"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" /> Postal Address
                        </Label>
                        <Input
                          value={postalAddress}
                          onChange={(e) => setPostalAddress(e.target.value)}
                          placeholder="123 Rue Example, Paris"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">First Name *</Label>
                          <Input
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Jean"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Last Name *</Label>
                          <Input
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Dupont"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" /> Date of Birth
                          </Label>
                          <Input
                            type="date"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Flag className="h-3 w-3" /> Nationality
                          </Label>
                          <Input
                            value={nationality}
                            onChange={(e) => setNationality(e.target.value)}
                            placeholder="French"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Mail className="h-3 w-3" /> Email *
                        </Label>
                        <Input
                          type="email"
                          value={indEmail}
                          onChange={(e) => setIndEmail(e.target.value)}
                          placeholder="jean@example.com"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}

                  {/* Common fields */}
                  <div className="border-t border-border/40 pt-4 space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <FileText className="h-3 w-3" /> Description / Mission
                      </Label>
                      <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief description of your activities..."
                        className="mt-1 h-16 text-sm"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        Activity Domains
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {ACTIVITY_DOMAINS.map((d) => (
                          <Badge
                            key={d}
                            variant={selectedDomains.includes(d) ? "default" : "outline"}
                            className="cursor-pointer text-[10px] transition-colors"
                            onClick={() => toggleDomain(d)}
                          >
                            {d}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">
                        Logo / Avatar
                      </Label>
                      <div className="flex items-center gap-3">
                        {avatarPreview ? (
                          <img
                            src={avatarPreview}
                            alt="Avatar"
                            className="h-10 w-10 rounded-lg object-cover border border-border"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <Upload className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <label className="cursor-pointer">
                          <span className="text-xs text-primary hover:underline">
                            {avatarPreview ? "Change file" : "Upload file"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={goNext}
                    disabled={!isStep2Valid()}
                    className="w-full"
                    size="lg"
                  >
                    Continue
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </motion.div>
              )}

              {/* Step 3: Key Generation */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ x: 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -60, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <button
                    onClick={goBack}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back
                  </button>

                  <h2 className="text-base font-semibold text-foreground">
                    Post-Quantum Key Generation
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Generate your CRYSTALS-Dilithium keypair. Private keys never leave your device.
                  </p>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-200 leading-snug">
                      Your private key is stored locally on your device only. If lost, it cannot be recovered. Make sure to back it up securely.
                    </p>
                  </div>

                  {!keysGenerated ? (
                    <div className="flex flex-col items-center gap-4 py-6">
                      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                        <KeyRound className="h-7 w-7 text-muted-foreground" />
                      </div>
                      <Button
                        onClick={handleGenerateKeys}
                        disabled={generatingKeys}
                        size="lg"
                        className="w-full"
                      >
                        {generatingKeys ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Generating keys via WASM…
                          </>
                        ) : (
                          <>
                            <KeyRound className="h-4 w-4 mr-2" />
                            Generate My Keys
                          </>
                        )}
                      </Button>
                      {generatingKeys && (
                        <p className="text-[10px] text-muted-foreground text-center">
                          Running CRYSTALS-Dilithium in WebAssembly…
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 text-green-600" />
                          <span className="text-xs font-medium text-foreground">Public Key</span>
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground break-all leading-relaxed">
                          {publicKey}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-xs font-medium text-foreground">Private Key (hidden)</span>
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {privateKeyPreview}
                        </p>
                      </div>
                      <Button onClick={goNext} className="w-full" size="lg">
                        Continue
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 4: Identity Verification */}
              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ x: 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -60, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <button
                    onClick={goBack}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back
                  </button>

                  <h2 className="text-base font-semibold text-foreground">
                    Identity Verification
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Upload an official document (ID card, KBIS, passport) for EdgeDoc AI analysis.
                    {role === "verifier" && " Verifier registration requires document approval."}
                  </p>

                  {verificationStatus === "idle" && (
                    <label className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 p-8 cursor-pointer hover:border-primary/30 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Drop your document here or click to browse
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        PDF, JPG, PNG — Max 10MB
                      </span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleVerificationUpload}
                        className="hidden"
                      />
                    </label>
                  )}

                  {verificationStatus === "analyzing" && (
                    <div className="flex flex-col items-center gap-4 py-6">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <div className="w-full space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>EdgeDoc AI analyzing…</span>
                          <span>{fraudScore}%</span>
                        </div>
                        <Progress value={fraudScore} className="h-1.5" />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Checking for tampering, anomalies, and authenticity markers…
                      </p>
                    </div>
                  )}

                  {verificationStatus === "verified" && (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4 flex gap-3">
                        <FileCheck className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">
                            Document Verified
                          </p>
                          <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                            Authenticity score: {fraudScore}% — No anomalies detected.
                          </p>
                          <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 font-mono">
                            {verificationFile?.name}
                          </p>
                        </div>
                      </div>
                      <Button onClick={goNext} className="w-full" size="lg">
                        Continue to Registration
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}

                  {verificationStatus === "rejected" && (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4 flex gap-3">
                        <X className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">
                            Document Rejected
                          </p>
                          <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                            Fraud score: {fraudScore}% — Suspicious anomalies detected.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setVerificationStatus("idle");
                          setVerificationFile(null);
                        }}
                        className="w-full"
                      >
                        Try Another Document
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 5: Blockchain Registration */}
              {currentStep === 5 && (
                <motion.div
                  key="step5"
                  initial={{ x: 60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -60, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <button
                    onClick={goBack}
                    disabled={submitting || registered}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Back
                  </button>

                  <h2 className="text-base font-semibold text-foreground">
                    Register on Blockchain
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Submit your registration to <span className="font-mono text-foreground">{contractName}</span> on ZKsync Atlas L2.
                  </p>

                  {/* Summary */}
                  <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Role</span>
                      <span className="font-medium text-foreground">{roleLabel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium text-foreground capitalize">{entityType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">DID</span>
                      <span className="font-mono text-foreground text-[10px]">
                        {did.slice(0, 20)}…{did.slice(-8)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Wallet</span>
                      <span className="font-mono text-foreground text-[10px]">
                        {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Keys</span>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Check className="h-2.5 w-2.5 text-green-600" />
                        Dilithium
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Verification</span>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <ShieldCheck className="h-2.5 w-2.5 text-green-600" />
                        EdgeDoc OK
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Metadata</span>
                      <span className="text-foreground">Public (on-chain)</span>
                    </div>
                  </div>

                  {!registered ? (
                    <>
                      {txHash && !registered && (
                        <div className="flex flex-col items-center gap-3 py-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <p className="text-xs text-muted-foreground">Confirming transaction…</p>
                          <p className="font-mono text-[10px] text-muted-foreground break-all">
                            {txHash}
                          </p>
                        </div>
                      )}
                      <Button
                        onClick={handleBlockchainSubmit}
                        disabled={submitting}
                        className="w-full"
                        size="lg"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            {txHash ? "Confirming…" : "Signing transaction…"}
                          </>
                        ) : (
                          <>
                            <Wallet className="h-4 w-4 mr-2" />
                            Submit Registration
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-4 text-center space-y-2">
                        <BadgeCheck className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto" />
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                          Registration Confirmed
                        </p>
                        <p className="text-[10px] font-mono text-green-700 dark:text-green-300 break-all">
                          TX: {txHash?.slice(0, 20)}…{txHash?.slice(-8)}
                        </p>
                      </div>

                      {role === "verifier" && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 flex gap-2">
                          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800 dark:text-amber-200 leading-snug">
                            Your verifier registration requires approval. You'll receive a notification once approved based on your EdgeDoc verification score.
                          </p>
                        </div>
                      )}

                      <Button
                        onClick={() => navigate(`/${role}`)}
                        className="w-full"
                        size="lg"
                      >
                        Go to Dashboard
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-center gap-1.5 border-t border-border/40 py-3">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              End-to-end encrypted · Quantum-resistant
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

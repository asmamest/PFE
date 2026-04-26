import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Search,
  Building2,
  ChevronRight,
  ChevronLeft,
  FileText,
  Upload,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface Issuer {
  id: string;
  name: string;
  type: string;
  credentialTypes: string[];
}

const mockIssuers: Issuer[] = [
  { id: "1", name: "Université Paris-Saclay", type: "University", credentialTypes: ["Bachelor's Degree", "Master's Degree", "PhD", "Transcript"] },
  { id: "2", name: "Government of France", type: "Government", credentialTypes: ["National ID Card", "Passport", "Driver's License", "Birth Certificate"] },
  { id: "3", name: "Acme Corp", type: "Enterprise", credentialTypes: ["Employment Certificate", "Reference Letter", "Salary Attestation"] },
  { id: "4", name: "CertiHealth", type: "Healthcare", credentialTypes: ["Vaccination Record", "Medical Certificate", "Insurance Card"] },
  { id: "5", name: "SkillVerify DAO", type: "DAO", credentialTypes: ["Professional Certification", "Skill Badge", "Course Completion"] },
];

interface FormField {
  key: string;
  label: string;
  type: "text" | "date";
  required: boolean;
}

const credentialFormFields: Record<string, FormField[]> = {
  default: [
    { key: "fullName", label: "Full Name", type: "text", required: true },
    { key: "dateOfBirth", label: "Date of Birth", type: "date", required: true },
  ],
  "Master's Degree": [
    { key: "fullName", label: "Full Name", type: "text", required: true },
    { key: "studentId", label: "Student ID", type: "text", required: true },
    { key: "program", label: "Program", type: "text", required: true },
    { key: "graduationDate", label: "Graduation Date", type: "date", required: true },
  ],
  "National ID Card": [
    { key: "fullName", label: "Full Name", type: "text", required: true },
    { key: "dateOfBirth", label: "Date of Birth", type: "date", required: true },
    { key: "placeOfBirth", label: "Place of Birth", type: "text", required: true },
    { key: "nationality", label: "Nationality", type: "text", required: true },
  ],
  "Employment Certificate": [
    { key: "fullName", label: "Full Name", type: "text", required: true },
    { key: "position", label: "Position", type: "text", required: true },
    { key: "startDate", label: "Start Date", type: "date", required: true },
    { key: "department", label: "Department", type: "text", required: false },
  ],
};

type Step = "issuer" | "type" | "form" | "submitted";

export function RequestCredentialSection() {
  const [step, setStep] = useState<Step>("issuer");
  const [issuerSearch, setIssuerSearch] = useState("");
  const [selectedIssuer, setSelectedIssuer] = useState<Issuer | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const filteredIssuers = mockIssuers.filter(
    (i) => i.name.toLowerCase().includes(issuerSearch.toLowerCase()) || i.type.toLowerCase().includes(issuerSearch.toLowerCase())
  );

  const fields = selectedType ? (credentialFormFields[selectedType] || credentialFormFields.default) : [];

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 2000));
    setSubmitting(false);
    setStep("submitted");
    toast({ title: "Request submitted", description: "Your credential request has been sent to the issuer." });
  };

  const reset = () => {
    setStep("issuer");
    setSelectedIssuer(null);
    setSelectedType(null);
    setFormData({});
  };

  const avatarUrl = (name: string) =>
    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=4F46E5`;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Request Credential</h1>
        <p className="text-sm text-muted-foreground">Request a new verifiable credential from a registered issuer.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {["Select Issuer", "Credential Type", "Fill Form", "Submitted"].map((label, i) => {
          const stepIdx = ["issuer", "type", "form", "submitted"].indexOf(step);
          return (
            <div key={label} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                i <= stepIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {i < stepIdx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={i <= stepIdx ? "text-foreground font-medium" : ""}>{label}</span>
              {i < 3 && <ChevronRight className="h-3 w-3" />}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Issuer */}
        {step === "issuer" && (
          <motion.div key="issuer" initial={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search issuers..." value={issuerSearch} onChange={(e) => setIssuerSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="space-y-2">
              {filteredIssuers.map((issuer) => (
                <motion.button
                  key={issuer.id}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => { setSelectedIssuer(issuer); setStep("type"); }}
                  className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-secondary/40"
                >
                  <img src={avatarUrl(issuer.name)} alt={issuer.name} className="h-10 w-10 rounded-full" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{issuer.name}</p>
                    <p className="text-xs text-muted-foreground">{issuer.type} · {issuer.credentialTypes.length} credential types</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 2: Type */}
        {step === "type" && selectedIssuer && (
          <motion.div key="type" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} transition={{ duration: 0.25 }}>
            <button onClick={() => setStep("issuer")} className="mb-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
            <Card className="mb-4">
              <CardContent className="p-3 flex items-center gap-3">
                <img src={avatarUrl(selectedIssuer.name)} alt={selectedIssuer.name} className="h-8 w-8 rounded-full" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedIssuer.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedIssuer.type}</p>
                </div>
              </CardContent>
            </Card>
            <p className="text-sm font-medium text-foreground mb-3">Select credential type:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedIssuer.credentialTypes.map((type) => (
                <motion.button
                  key={type}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedType(type); setStep("form"); }}
                  className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-secondary/40"
                >
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">{type}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 3: Form */}
        {step === "form" && selectedIssuer && selectedType && (
          <motion.div key="form" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0 }} transition={{ duration: 0.25 }}>
            <button onClick={() => setStep("type")} className="mb-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </button>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  {selectedType}
                  <span className="text-xs font-normal text-muted-foreground">from {selectedIssuer.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {field.label} {field.required && <span className="text-destructive">*</span>}
                    </label>
                    <Input
                      type={field.type}
                      value={formData[field.key] || ""}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={field.label}
                    />
                  </div>
                ))}

                {/* Attachments */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Supporting Documents (optional)</label>
                  <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-4 text-center">
                    <Upload className="h-5 w-5 text-muted-foreground mx-auto" />
                    <span className="text-xs text-muted-foreground">Drag & drop or click to attach files</span>
                  </div>
                </div>

                <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-1.5">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Submit Request
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 4: Submitted */}
        {step === "submitted" && (
          <motion.div key="submitted" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }} className="flex flex-col items-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Request Submitted</h2>
            <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
              Your request for "{selectedType}" has been sent to {selectedIssuer?.name}. It will appear as "Pending" in your credentials.
            </p>
            <Button onClick={reset} variant="outline" className="mt-6">
              Submit Another Request
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// src/components/holder/RequestCredentialSection.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, ChevronLeft, Send, Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Issuer {
  id: string;
  name: string;
  type: string;
  credentialTypes: string[];
}

const mockIssuers: Issuer[] = [
  { id: "1", name: "Université Paris-Saclay", type: "University", credentialTypes: ["Bachelor's Degree", "Master's Degree", "PhD"] },
  { id: "2", name: "Government of France", type: "Government", credentialTypes: ["National ID Card", "Passport"] },
  { id: "3", name: "Acme Corp", type: "Enterprise", credentialTypes: ["Employment Certificate"] },
];

type Step = "issuer" | "type" | "submitted";

export function RequestCredentialSection() {
  const [step, setStep] = useState<Step>("issuer");
  const [search, setSearch] = useState("");
  const [selectedIssuer, setSelectedIssuer] = useState<Issuer | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredIssuers = mockIssuers.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 2000));
    setSubmitting(false);
    setStep("submitted");
    toast({ title: "Request submitted", description: "Your request has been sent to the issuer." });
  };

  const reset = () => {
    setStep("issuer");
    setSelectedIssuer(null);
    setSelectedType(null);
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Request a Credential</h2>
        <p className="text-xs text-muted-foreground">Request a new verifiable credential from a registered issuer.</p>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {["Select Issuer", "Credential Type", "Submitted"].map((label, i) => {
          const stepIdx = ["issuer", "type", "submitted"].indexOf(step);
          return (
            <div key={label} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${i <= stepIdx ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {i < stepIdx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span>{label}</span>
              {i < 2 && <ChevronRight className="h-3 w-3" />}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {step === "issuer" && (
          <motion.div key="issuer" initial={{ x: 0 }} animate={{ x: 0 }} exit={{ x: -40 }} transition={{ duration: 0.25 }}>
            <Input placeholder="Search issuers..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />
            <div className="space-y-2">
              {filteredIssuers.map(issuer => (
                <button key={issuer.id} onClick={() => { setSelectedIssuer(issuer); setStep("type"); }} className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left hover:border-primary/30 transition-all">
                  <div className="flex-1"><p className="font-medium">{issuer.name}</p><p className="text-xs text-muted-foreground">{issuer.type}</p></div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === "type" && selectedIssuer && (
          <motion.div key="type" initial={{ x: 40 }} animate={{ x: 0 }} exit={{ x: -40 }}>
            <button onClick={() => setStep("issuer")} className="mb-3 flex items-center gap-1 text-xs text-muted-foreground"><ChevronLeft className="h-3.5 w-3.5" /> Back</button>
            <p className="mb-3 text-sm font-medium">Select credential type:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedIssuer.credentialTypes.map(type => (
                <button key={type} onClick={() => { setSelectedType(type); handleSubmit(); }} className="rounded-xl border border-border/60 bg-card p-3 text-left hover:border-primary/30">
                  {type}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === "submitted" && (
          <motion.div key="submitted" initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex flex-col items-center py-12">
            <CheckCircle2 className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold">Request Submitted</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mt-2">Your request for "{selectedType}" has been sent to {selectedIssuer?.name}.</p>
            <Button onClick={reset} variant="outline" className="mt-6">Submit Another Request</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
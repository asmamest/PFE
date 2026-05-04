// src/components/holder/RequestCredentialSection.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, ChevronLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

interface IssuerInfo {
  address: string;
  legal_name: string;
  credential_types: string[];
}

type Step = "issuer" | "type" | "submitted";

export function RequestCredentialSection() {
  const [step, setStep] = useState<Step>("issuer");
  const [search, setSearch] = useState("");
  const [issuers, setIssuers] = useState<IssuerInfo[]>([]);
  const [loadingIssuers, setLoadingIssuers] = useState(true);
  const [selectedIssuer, setSelectedIssuer] = useState<IssuerInfo | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8083/issuers")
      .then(res => res.json())
      .then(data => {
        setIssuers(data.issuers || []);
        setLoadingIssuers(false);
      })
      .catch(err => {
        console.error(err);
        toast({ title: "Error", description: "Failed to load issuers", variant: "destructive" });
        setLoadingIssuers(false);
      });
  }, []);

  const filteredIssuers = issuers.filter(i =>
    i.legal_name.toLowerCase().includes(search.toLowerCase()) ||
    i.address.toLowerCase().includes(search.toLowerCase())
  );

  const getCurrentHolderAddress = async (): Promise<string> => {
    if (!window.ethereum) throw new Error("MetaMask not installed");
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (!accounts || accounts.length === 0) {
      const newAccounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!newAccounts || newAccounts.length === 0) throw new Error("No wallet account found");
      return newAccounts[0];
    }
    return accounts[0];
  };

  const handleSubmit = async () => {
    let currentAddress: string;
    try {
      currentAddress = await getCurrentHolderAddress();
    } catch (err: any) {
      toast({ title: "Wallet error", description: err.message, variant: "destructive" });
      return;
    }
    if (!currentAddress) {
      toast({ title: "Missing address", description: "No wallet address found.", variant: "destructive" });
      return;
    }
    if (!selectedIssuer || !selectedType) {
      toast({ title: "Incomplete selection", description: "Please select an issuer and a credential type.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("http://localhost:8083/credential-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holder: currentAddress,
          issuer: selectedIssuer.address,
          credentialType: selectedType,
          message,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to send request");
      }
      setStep("submitted");
      toast({ title: "Request submitted", description: "Your request has been sent to the issuer." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep("issuer");
    setSelectedIssuer(null);
    setSelectedType(null);
    setMessage("");
    setSearch("");
  };

  if (loadingIssuers) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            <Input placeholder="Search issuers by name or address..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />
            <div className="space-y-2">
              {filteredIssuers.map(issuer => (
                <button key={issuer.address} onClick={() => { setSelectedIssuer(issuer); setStep("type"); }} className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left hover:border-primary/30 transition-all">
                  <div className="flex-1">
                    <p className="font-medium">{issuer.legal_name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{issuer.address.slice(0, 10)}...{issuer.address.slice(-8)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
              {filteredIssuers.length === 0 && <p className="text-center text-muted-foreground py-4">No issuers found</p>}
            </div>
          </motion.div>
        )}

        {step === "type" && selectedIssuer && (
          <motion.div key="type" initial={{ x: 40 }} animate={{ x: 0 }} exit={{ x: -40 }} transition={{ duration: 0.25 }}>
            <button onClick={() => setStep("issuer")} className="mb-3 flex items-center gap-1 text-xs text-muted-foreground"><ChevronLeft className="h-3.5 w-3.5" /> Back</button>
            <p className="mb-2 text-sm font-medium">Select credential type:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {selectedIssuer.credential_types.map(type => (
                <button key={type} onClick={() => setSelectedType(type)} className="rounded-xl border border-border/60 bg-card p-3 text-left hover:border-primary/30">{type}</button>
              ))}
            </div>
            <div className="mt-4">
              <Label htmlFor="message">Message (optional)</Label>
              <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" placeholder="Add any additional information..." />
            </div>
            <Button onClick={handleSubmit} disabled={!selectedType || submitting} className="mt-4 w-full">{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Submit Request</Button>
          </motion.div>
        )}

        {step === "submitted" && (
          <motion.div key="submitted" initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex flex-col items-center py-12">
            <CheckCircle2 className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-lg font-semibold">Request Submitted</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mt-2">Your request for "{selectedType}" has been sent to {selectedIssuer?.legal_name}.</p>
            <Button onClick={reset} variant="outline" className="mt-6">Submit Another Request</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
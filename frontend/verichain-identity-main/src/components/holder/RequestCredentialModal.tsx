// src/components/holder/RequestCredentialModal.tsx
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface IssuerInfo {
  address: string;
  legal_name: string;
  credential_types: string[];
}

interface RequestCredentialModalProps {
  holderDid: string;
  holderAddress: string;
  onClose: () => void;
}

export function RequestCredentialModal({ holderDid, holderAddress, onClose }: RequestCredentialModalProps) {
  const [issuers, setIssuers] = useState<IssuerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssuerAddress, setSelectedIssuerAddress] = useState("");
  const [credentialType, setCredentialType] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8083/issuers")
      .then(res => res.json())
      .then(data => {
        setIssuers(data.issuers || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        toast({ title: "Error", description: "Failed to load issuers", variant: "destructive" });
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssuerAddress || !credentialType) {
      toast({ title: "Missing fields", description: "Please select an issuer and enter a credential type", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("http://localhost:8083/credential-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holder: holderAddress,
          issuer: selectedIssuerAddress,
          credentialType,
          message,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to send request");
      }
      toast({ title: "Request sent", description: `Your request for "${credentialType}" has been sent.` });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl text-center">
          <p>Loading issuers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Request a Credential</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="issuer">Issuer</Label>
            <select
              id="issuer"
              value={selectedIssuerAddress}
              onChange={(e) => setSelectedIssuerAddress(e.target.value)}
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">Select an issuer</option>
              {issuers.map((issuer) => (
                <option key={issuer.address} value={issuer.address}>
                  {issuer.legal_name} ({issuer.address.slice(0, 6)}...{issuer.address.slice(-4)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="type">Credential Type</Label>
            <select
              id="type"
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value)}
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">Select a credential type</option>
              {selectedIssuerAddress &&
                issuers
                  .find(i => i.address === selectedIssuerAddress)
                  ?.credential_types.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <Label htmlFor="message">Message (optional)</Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="Add any additional information..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
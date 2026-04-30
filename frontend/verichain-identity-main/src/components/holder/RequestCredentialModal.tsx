// src/components/holder/RequestCredentialModal.tsx
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RequestCredentialModalProps {
  did?: string;
  onClose: () => void;
}

const MOCK_ISSUERS = [
  { did: "did:zk:0x111...", name: "TU Berlin" },
  { did: "did:zk:0x222...", name: "Acme Corp" },
  { did: "did:zk:0x333...", name: "Government of France" },
];

export function RequestCredentialModal({ did, onClose }: RequestCredentialModalProps) {
  const [selectedIssuer, setSelectedIssuer] = useState("");
  const [credentialType, setCredentialType] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssuer || !credentialType) return;

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1500));
    alert(`Demande envoyée à ${selectedIssuer} pour le credential "${credentialType}"`);
    setSubmitting(false);
    onClose();
  };

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
              value={selectedIssuer}
              onChange={(e) => setSelectedIssuer(e.target.value)}
              className="w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">Select an issuer</option>
              {MOCK_ISSUERS.map((issuer) => (
                <option key={issuer.did} value={issuer.name}>
                  {issuer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="type">Credential Type</Label>
            <Input
              id="type"
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value)}
              placeholder="e.g., Diploma, Employment Proof"
              required
            />
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

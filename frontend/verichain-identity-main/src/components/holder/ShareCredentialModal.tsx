// src/components/holder/ShareCredentialModal.tsx
import { useState } from "react";
import { X, Copy, Check, QrCode, ShieldCheck, Eye } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { CredentialData } from "./CredentialCard";

interface ShareCredentialModalProps {
  credential: CredentialData;
  onClose: () => void;
}

type ShareMode = "direct" | "zkp";

export function ShareCredentialModal({ credential, onClose }: ShareCredentialModalProps) {
  const [mode, setMode] = useState<ShareMode>("direct");
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>(["fullName", "degree"]);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    const payload = JSON.stringify({
      credentialId: credential.id,
      mode,
      attributes: mode === "zkp" ? selectedAttributes : undefined,
      holderDid: "did:zk:0xE5B98b...",
      timestamp: Date.now(),
    });
    setGeneratedQR(payload);
  };

  const copyToClipboard = () => {
    if (generatedQR) {
      navigator.clipboard.writeText(generatedQR);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Share credential</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-1">Credential</p>
            <p className="text-sm text-foreground">{credential.name}</p>
            <p className="text-xs text-muted-foreground">Issued by {credential.issuer}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setMode("direct")}
              className={`flex-1 py-2 rounded-lg border transition-colors ${
                mode === "direct"
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="text-sm">Direct</span>
              </div>
            </button>
            <button
              onClick={() => setMode("zkp")}
              className={`flex-1 py-2 rounded-lg border transition-colors ${
                mode === "zkp"
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-sm">Zero-Knowledge (ZKP)</span>
              </div>
            </button>
          </div>

          {mode === "zkp" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Attributes to reveal</p>
              <div className="flex flex-wrap gap-2">
                {["fullName", "degree", "graduationDate", "grade"].map((attr) => (
                  <label key={attr} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedAttributes.includes(attr)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAttributes([...selectedAttributes, attr]);
                        } else {
                          setSelectedAttributes(selectedAttributes.filter((a) => a !== attr));
                        }
                      }}
                      className="rounded border-border"
                    />
                    {attr}
                  </label>
                ))}
              </div>
            </div>
          )}

          {!generatedQR ? (
            <Button onClick={handleGenerate} className="w-full">
              Generate {mode === "direct" ? "share link" : "ZKP proof"}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-center p-3 bg-white rounded-xl">
                <QRCodeCanvas value={generatedQR} size={180} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyToClipboard} className="flex-1 gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copy data
                </Button>
                <Button onClick={onClose} variant="outline" className="flex-1">
                  Close
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Share this QR code with the verifier.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

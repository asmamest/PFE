// src/components/holder/QuickActions.tsx
import { useState } from "react";
import { Plus, QrCode, FileSignature, FilePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { RequestCredentialModal } from "./RequestCredentialModal";

const actions = [
  { icon: FilePlus,       label: "Request Credential", id: "request" },
  { icon: FileSignature,  label: "Generate Proof",      id: "proof"   },
  { icon: QrCode,         label: "Scan QR",             id: "scan"    },
];

interface QuickActionsProps {
  did?: string;
}

export function QuickActions({ did }: QuickActionsProps) {
  const [open, setOpen] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const navigate = useNavigate();

  const handleAction = (id: string) => {
    setOpen(false);
    if (id === "request") setShowRequestModal(true);
    else if (id === "proof")   setShowProofModal(true);
    else if (id === "scan")    navigate("/holder/scan");
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {open &&
          actions.map((a, i) => {
            const Icon = a.icon;
            return (
              <div
                key={a.id}
                className="flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in"
                style={{ animationDuration: "200ms", animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
              >
                <span className="text-xs font-medium text-foreground bg-card border border-border/60 rounded-full px-3 py-1.5 shadow-md whitespace-nowrap">
                  {a.label}
                </span>
                <button
                  onClick={() => handleAction(a.id)}
                  className="size-11 rounded-full bg-gradient-to-br from-primary/80 to-accent grid place-items-center shadow-lg hover:scale-105 transition-transform"
                >
                  <Icon className="size-4 text-white" />
                </button>
              </div>
            );
          })}

        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "size-14 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-105",
            open && "rotate-45"
          )}
        >
          <Plus className="size-6 text-white" />
        </button>
      </div>

      {showRequestModal && (
        <RequestCredentialModal did={did} onClose={() => setShowRequestModal(false)} />
      )}

      {showProofModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="font-semibold text-foreground">Generate ZKP Proof</h3>
            <p className="text-sm text-muted-foreground">
              Select a credential to generate a zero-knowledge proof. The verifier will receive only the
              attributes you select, without seeing the full credential.
            </p>
            <div className="bg-secondary/30 rounded-xl p-3 text-xs text-muted-foreground font-mono border border-border/40">
              [ZKP generation will be connected to POST /api/zkp/generate]
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowProofModal(false)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowProofModal(false)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Generate (Mock)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

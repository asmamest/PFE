import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ChevronDown, ShieldCheck, Wallet, Fingerprint, KeyRound } from "lucide-react";
import { copyToClipboard, truncateMiddle, formatDateTime } from "@/lib/issuer-utils";

interface IdentityHeaderProps {
  walletAddress: string;
  did: string;
  publicKey: string;
  role: "issuer" | "holder";
  registeredAt: number;
}

export function IdentityHeader({
  walletAddress,
  did,
  publicKey,
  role,
  registeredAt,
}: IdentityHeaderProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleCopy = async (label: string, value: string) => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CopyChip
        icon={<Wallet className="h-5 w-5" />}
        label="Wallet"
        value={truncateMiddle(walletAddress)}
        full={walletAddress}
        copied={copied === "wallet"}
        onCopy={() => handleCopy("wallet", walletAddress)}
      />
      <CopyChip
        icon={<Fingerprint className="h-5 w-5" />}
        label="DID"
        value={truncateMiddle(did, 10, 6)}
        full={did}
        copied={copied === "did"}
        onCopy={() => handleCopy("did", did)}
      />
      <CopyChip
        icon={<KeyRound className="h-5 w-5" />}
        label="ML-DSA"
        value={truncateMiddle(publicKey, 8, 6)}
        full={publicKey}
        copied={copied === "key"}
        onCopy={() => handleCopy("key", publicKey)}
      />
      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
        <ShieldCheck className="h-5 w-5" />
        {role}
      </span>

    </div>
  );
}

function CopyChip({
  icon,
  label,
  value,
  full,
  copied,
  onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  full: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      onClick={onCopy}
      title={`Copier ${full}`}
      className="group inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-mono text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[9px] font-sans font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span>{value}</span>
      {copied ? (
        <Check className="h-5 w-5 text-success" />
      ) : (
        <Copy className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}

function DetailRow({
  label,
  value,
  onCopy,
  copied,
  multiline,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {onCopy && (
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1 text-[9px] text-muted-foreground hover:text-primary"
          >
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </button>
        )}
      </div>
      <p
        className={`mt-0.5 break-all rounded-md bg-secondary/40 px-2 py-1 font-mono text-[10px] text-foreground ${
          multiline ? "max-h-20 overflow-y-auto" : "truncate"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
// src/components/holder/IdentityHero.tsx
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, ShieldCheck, Clock, CheckCircle2, Fingerprint } from "lucide-react";

interface IdentityHeroProps {
  did: string;
  walletAddress: string;
  createdAt?: number;
}

export function IdentityHero({ did, walletAddress, createdAt }: IdentityHeroProps) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && did) {
      QRCode.toCanvas(canvasRef.current, did, {
        width: 100,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#1e293b", light: "#ffffff" },
      });
    }
  }, [did]);

  const copy = () => {
    navigator.clipboard.writeText(did);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown";

  const shortWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "—";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-6 md:p-8">
      <div className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 size-44 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative grid md:grid-cols-[1fr_auto_auto] gap-6 items-center">
        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-green-500/15 text-green-600 border border-green-500/25">
              <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
              Active
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Fingerprint className="size-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Decentralized Identifier
              </span>
            </div>
            <div className="flex items-start gap-2">
              <code className="font-mono text-sm break-all text-foreground leading-relaxed flex-1">
                {did}
              </code>
              <button
                onClick={copy}
                title="Copy DID"
                className="shrink-0 mt-0.5 size-7 grid place-items-center rounded-lg bg-secondary/70 hover:bg-primary/15 transition-colors"
              >
                {copied ? (
                  <CheckCircle2 className="size-3.5 text-green-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
            {copied && (
              <p className="text-[11px] text-green-500 mt-1 font-medium">Copied to clipboard!</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3" />
              Registered {formattedDate}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-muted-foreground/40" />
              Wallet: <code className="font-mono ml-0.5">{shortWallet}</code>
            </span>
          </div>
        </div>

        <div className="hidden md:block w-px h-28 bg-gradient-to-b from-transparent via-border to-transparent" />

        <div className="flex flex-col items-center gap-2">
          <div className="p-2.5 rounded-xl bg-white shadow-lg ring-1 ring-border/30">
            <canvas ref={canvasRef} width={100} height={100} />
          </div>
          <span className="text-[10px] text-muted-foreground">Scan DID</span>
        </div>
      </div>
    </div>
  );
}

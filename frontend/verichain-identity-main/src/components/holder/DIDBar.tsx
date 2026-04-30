// src/components/holder/DIDBar.tsx
import { useState } from "react";
import { Copy, Check, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DIDBar({ did, chain = "zkSync Sepolia" }: { did: string; chain?: string }) {
  const [copied, setCopied] = useState(false);
  const truncated = did.length > 28 ? did.slice(0, 16) + "…" + did.slice(-8) : did;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(did);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-3 bg-secondary/30 rounded-xl px-4 py-2.5 border border-border/50">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">DID</span>
      <code className="font-mono text-sm text-foreground flex-1 truncate">{truncated}</code>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <span className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        "bg-primary/10 text-primary border-primary/20"
      )}>
        <Network className="h-3 w-3" />
        {chain}
      </span>
    </div>
  );
}
// components/identity/did-bar.tsx
import { useState } from "react";
import { Copy, Check, Network } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DIDBarProps {
  did: string;
  chain?: string;
}

function truncateDID(did: string): string {
  if (did.length <= 28) return did;
  return did.slice(0, 16) + "…" + did.slice(-8);
}

export function DIDBar({ did, chain = "ZKsync Atlas L2" }: DIDBarProps) {
  const [copied, setCopied] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(did);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-muted/50 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
      <span className="text-xs uppercase tracking-widest text-muted-foreground flex-shrink-0">
        Your DID
      </span>
      <span className="font-mono text-sm text-muted-foreground flex-1 truncate min-w-0">
        {truncateDID(did)}
      </span>
      <motion.div
        animate={
          copied && !shouldReduceMotion
            ? { scale: [1, 0.95, 1.05, 1] }
            : {}
        }
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </motion.div>
      <span className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
        "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800"
      )}>
        <Network className="h-3 w-3" />
        {chain}
      </span>
    </div>
  );
}

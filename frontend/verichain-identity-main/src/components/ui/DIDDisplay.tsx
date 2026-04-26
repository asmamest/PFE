import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

interface DIDDisplayProps {
  did: string;
  className?: string;
}

export function DIDDisplay({ did, className }: DIDDisplayProps) {
  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 font-mono text-sm", className)}>
      <span className="truncate max-w-[200px]">{did}</span>
      <CopyButton value={did} />
    </div>
  );
}

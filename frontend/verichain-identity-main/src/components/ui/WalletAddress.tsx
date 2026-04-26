import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

interface WalletAddressProps {
  address: string;
  className?: string;
}

export function WalletAddress({ address, className }: WalletAddressProps) {
  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-mono text-xs", className)}>
      <span>{truncated}</span>
      <CopyButton value={address} />
    </div>
  );
}

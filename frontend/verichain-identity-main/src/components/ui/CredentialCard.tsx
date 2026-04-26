import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

interface CredentialCardProps {
  type: string;
  issuer: string;
  issuedDate: string;
  expiryDate?: string;
  status: "active" | "pending" | "revoked" | "expired";
  cid?: string;
  aiVerified?: boolean;
  className?: string;
}

export function CredentialCard({
  type, issuer, issuedDate, expiryDate, status, cid, aiVerified, className,
}: CredentialCardProps) {
  const avatarUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(issuer)}&backgroundColor=4F46E5`;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn("rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md", className)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <img src={avatarUrl} alt={issuer} className="h-10 w-10 rounded-full" />
          <div>
            <h4 className="text-sm font-semibold text-card-foreground">{type}</h4>
            <p className="text-xs text-muted-foreground">{issuer}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span>Issued: {issuedDate}</span>
        {expiryDate && <span>Expires: {expiryDate}</span>}
      </div>
      {aiVerified && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          AI Verified
        </span>
      )}
      {cid && (
        <p className="mt-2 truncate font-mono text-xs text-muted-foreground">CID: {cid}</p>
      )}
      <button className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        View Details <ExternalLink className="h-3 w-3" />
      </button>
    </motion.div>
  );
}

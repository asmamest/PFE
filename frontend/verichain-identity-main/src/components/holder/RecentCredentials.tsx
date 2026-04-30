// src/components/holder/RecentCredentials.tsx
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface Credential {
  id: string;
  name: string;
  issuer: string;
  issuerSeed: string;
  expiresAt?: string;
  status: "active" | "pending" | "expired" | "revoked";
}

interface RecentCredentialsProps {
  credentials: Credential[];
  viewAllHref?: string;
}

export function RecentCredentials({ credentials, viewAllHref = "/holder/credentials" }: RecentCredentialsProps) {
  const getInitials = (seed: string) => {
    return seed.split('-').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground">Recent credentials</h3>
        <Link to={viewAllHref} className="text-xs text-muted-foreground hover:text-primary transition-colors">
          View all →
        </Link>
      </div>
      <div className="divide-y divide-border/40">
        {credentials.map((cred) => (
          <div key={cred.id} className="flex items-center gap-3 px-5 py-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={`https://api.dicebear.com/9.x/initials/svg?seed=${cred.issuerSeed}&backgroundColor=4F46E5`} />
              <AvatarFallback className="text-[10px] font-medium">{getInitials(cred.issuerSeed)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{cred.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {cred.issuer} {cred.expiresAt && `· Expires ${new Date(cred.expiresAt).getFullYear()}`}
              </p>
            </div>
            <StatusBadge status={cred.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
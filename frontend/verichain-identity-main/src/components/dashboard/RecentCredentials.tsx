// components/dashboard/recent-credentials.tsx
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Credential } from "@/lib/mock-data";

interface RecentCredentialsProps {
  credentials: Credential[];
  viewAllHref?: string;
}

function formatYear(dateStr: string): string {
  return new Date(dateStr).getFullYear().toString();
}

export function RecentCredentials({ credentials, viewAllHref = "/dashboard/credentials" }: RecentCredentialsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4 px-5">
        <span className="text-sm font-medium">Recent credentials</span>
        <Link to={viewAllHref} className="text-xs text-muted-foreground hover:text-primary transition-colors">
          View all →
        </Link>
      </CardHeader>
      <CardContent className="px-5 pb-4 pt-0">
        {credentials.map((credential) => {
          const initials = credential.issuerSeed
            .split("-")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          // Map "expiring" to "pending" for the existing StatusBadge which doesn't have "expiring"
          const badgeStatus = credential.status === "expiring" ? "pending" : credential.status === "expired" ? "expired" : credential.status;

          return (
            <div key={credential.id} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage
                  src={`https://api.dicebear.com/9.x/initials/svg?seed=${credential.issuerSeed}&backgroundColor=0047AB`}
                />
                <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{credential.type}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {credential.issuer}
                  {credential.expiresAt && ` · Expires ${formatYear(credential.expiresAt)}`}
                </p>
              </div>
              <StatusBadge status={badgeStatus as "active" | "pending" | "revoked" | "expired"} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

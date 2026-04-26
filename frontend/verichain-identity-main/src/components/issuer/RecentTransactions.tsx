import { useEffect, useState } from "react";
import { ExternalLink, Activity, ShieldX, BadgeCheck } from "lucide-react";
import { truncateMiddle, formatDateTime } from "@/lib/issuer-utils";

export interface TxEvent {
  id: string;
  type: "issued" | "revoked";
  credentialId: string;
  holder: string;
  txHash: string;
  timestamp: number;
}

interface Props {
  events: TxEvent[];
}

export function RecentTransactions({ events }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Transactions récentes</h3>
      </div>
      {events.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">Aucune transaction</p>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  e.type === "issued" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                }`}
              >
                {e.type === "issued" ? <BadgeCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">
                  {e.type === "issued" ? "Credential émis" : "Credential révoqué"}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  {truncateMiddle(e.credentialId, 6, 4)} · holder {truncateMiddle(e.holder)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <a
                  href={`https://etherscan.io/tx/${e.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
                >
                  {truncateMiddle(e.txHash, 6, 4)}
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
                <ClientTime ts={e.timestamp} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClientTime({ ts }: { ts: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>
      {mounted ? formatDateTime(ts) : ""}
    </span>
  );
}
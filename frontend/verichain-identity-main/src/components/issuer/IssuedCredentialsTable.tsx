import { useMemo, useState } from "react";
import { Search, ExternalLink, ShieldX, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { truncateMiddle, formatDate } from "@/lib/issuer-utils";

export type CredentialStatus = "active" | "revoked" | "expired";

export interface IssuedCredential {
  id: string;
  holder: string;
  type: string;
  issuedAt: number;
  expiresAt: number | null;
  status: CredentialStatus;
  txHash: string;
}

interface Props {
  credentials: IssuedCredential[];
  onRevoke: (id: string, reason: string) => void;
}

const PAGE_SIZE = 5;

const statusStyles: Record<CredentialStatus, string> = {
  active: "bg-success/10 text-success",
  revoked: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
};

export function IssuedCredentialsTable({ credentials, onRevoke }: Props) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const types = useMemo(
    () => Array.from(new Set(credentials.map((c) => c.type))),
    [credentials],
  );

  const filtered = useMemo(() => {
    return credentials.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (search && !c.holder.toLowerCase().includes(search.toLowerCase())) return false;
      if (from && c.issuedAt < new Date(from).getTime()) return false;
      if (to && c.issuedAt > new Date(to).getTime() + 86_400_000) return false;
      return true;
    });
  }, [credentials, typeFilter, search, from, to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Credentials émis</h3>
      </div>

      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher par adresse holder…"
            className="pl-7 text-xs"
          />
        </div>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-xs" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-xs" />
      </div>

      <div className="flex flex-wrap gap-1 px-3 pb-3">
        <TypePill active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
          Tous
        </TypePill>
        {types.map((t) => (
          <TypePill key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
            {t}
          </TypePill>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">ID</th>
              <th className="px-3 py-2 text-left font-semibold">Holder</th>
              <th className="px-3 py-2 text-left font-semibold">Type</th>
              <th className="px-3 py-2 text-left font-semibold">Émis</th>
              <th className="px-3 py-2 text-left font-semibold">Expire</th>
              <th className="px-3 py-2 text-left font-semibold">Statut</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Aucun credential
                </td>
              </tr>
            )}
            {pageItems.map((c) => (
              <tr key={c.id} className="hover:bg-secondary/30">
                <td className="px-3 py-2 font-mono">{truncateMiddle(c.id, 6, 4)}</td>
                <td className="px-3 py-2 font-mono">{truncateMiddle(c.holder)}</td>
                <td className="px-3 py-2">{c.type}</td>
                <td className="px-3 py-2">{formatDate(c.issuedAt)}</td>
                <td className="px-3 py-2">{c.expiresAt ? formatDate(c.expiresAt) : "Jamais"}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyles[c.status]}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-1">
                    <a
                      href={`https://etherscan.io/tx/${c.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-1 text-[10px] text-muted-foreground hover:text-primary"
                      title="Voir transaction"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {c.status === "active" && (
                      <button
                        onClick={() => {
                          setRevokingId(c.id);
                          setReason("");
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-1.5 py-1 text-[10px] text-destructive hover:bg-destructive/10"
                        title="Révoquer"
                      >
                        <ShieldX className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <p className="text-[10px] text-muted-foreground">
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""} · page {page}/{totalPages}
        </p>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="h-7 px-2"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="h-7 px-2"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {revokingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-2xl">
            <h4 className="text-sm font-semibold text-foreground">Révoquer le credential</h4>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              {truncateMiddle(revokingId, 8, 6)}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Justification (obligatoire) — sera loggée off-chain (IPFS)"
              className="mt-3 w-full rounded-md border border-border bg-transparent px-3 py-2 text-xs"
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRevokingId(null)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!reason.trim()}
                onClick={() => {
                  onRevoke(revokingId, reason);
                  setRevokingId(null);
                  toast.success("Credential révoqué");
                }}
              >
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TypePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
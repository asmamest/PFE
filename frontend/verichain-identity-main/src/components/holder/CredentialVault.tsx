// src/components/holder/CredentialVault.tsx
import { useState, useCallback } from "react";
import { RefreshCw, GraduationCap, Briefcase, HeartPulse, Plane, FileText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CredentialCard, type CredentialData } from "./CredentialCard";
import { ShareCredentialModal } from "./ShareCredentialModal";
import { useNavigate } from "react-router-dom";

function getIcon(type?: string): LucideIcon {
  if (!type) return FileText;
  const lower = type.toLowerCase();
  if (lower.includes("education")) return GraduationCap;
  if (lower.includes("work") || lower.includes("employment")) return Briefcase;
  if (lower.includes("health")) return HeartPulse;
  if (lower.includes("travel")) return Plane;
  return FileText;
}

// Mock credentials
const MOCK_CREDENTIALS: CredentialData[] = [
  {
    id: "cred_001",
    name: "University Diploma",
    issuer: "TU Berlin",
    status: "active",
    type: "education",
    sensitivity: 2,
    issuedAt: "Jun 2024",
    icon: GraduationCap,
  },
  {
    id: "cred_002",
    name: "Employment Proof",
    issuer: "Acme Corp",
    status: "active",
    type: "work",
    sensitivity: 3,
    issuedAt: "Mar 2025",
    icon: Briefcase,
  },
  {
    id: "cred_003",
    name: "Health Insurance",
    issuer: "AOK",
    status: "active",
    type: "health",
    sensitivity: 3,
    issuedAt: "Jan 2025",
    icon: HeartPulse,
  },
  {
    id: "cred_004",
    name: "Travel Visa",
    issuer: "Govt. of FR",
    status: "expired",
    type: "travel",
    sensitivity: 2,
    issuedAt: "Aug 2023",
    icon: Plane,
  },
];

const FILTERS = ["All", "Education", "Work", "Health", "Travel"] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(cred: CredentialData, filter: Filter): boolean {
  if (filter === "All") return true;
  const lower = (cred.type ?? "").toLowerCase();
  return lower.includes(filter.toLowerCase());
}

interface CredentialVaultProps {
  did?: string;
  searchQuery?: string;
}

export function CredentialVault({ did, searchQuery = "" }: CredentialVaultProps) {
  const navigate = useNavigate();
  const [credentials] = useState<CredentialData[]>(MOCK_CREDENTIALS);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("All");
  const [shareTarget, setShareTarget] = useState<CredentialData | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  }, []);

  const displayed = credentials
    .filter((c) => matchesFilter(c, filter))
    .filter((c) =>
      searchQuery
        ? c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.issuer.toLowerCase().includes(searchQuery.toLowerCase())
        : true
    );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Credential Vault</h2>
          <p className="text-xs text-muted-foreground">
            {credentials.length} credential{credentials.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 text-xs">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg border transition-all duration-200 font-medium",
                  filter === f
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="size-8 grid place-items-center rounded-lg border border-border bg-secondary/30 hover:bg-secondary text-muted-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {loading && displayed.length === 0 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-36 rounded-xl border border-border/40 bg-secondary/20 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {searchQuery ? "No credentials match your search." : "No credentials found."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {displayed.map((cred) => (
            <CredentialCard
              key={cred.id}
              credential={cred}
              onShare={(id) => {
                const c = credentials.find((x) => x.id === id);
                if (c) setShareTarget(c);
              }}
              onView={(id) => navigate(`/holder/credentials/${id}`)}
              onManage={() => navigate("/holder/privacy")}
            />
          ))}
        </div>
      )}

      {shareTarget && (
        <ShareCredentialModal
          credential={shareTarget}
          onClose={() => setShareTarget(null)}
        />
      )}
    </section>
  );
}

// src/pages/RoleSelection.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, UserCircle2, FileSignature, ScanLine, ChevronRight, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { audit } from "@/lib/qsdid/audit";
import logo from "@/assets/logo.png";

type Role = "holder" | "issuer" | "verifier";
type AccountType = "individual" | "organization";

const roles: { key: Role; title: string; desc: string; icon: React.ReactNode }[] = [
  { key: "holder", title: "Holder", desc: "Receive and present verifiable credentials.", icon: <UserCircle2 className="h-5 w-5" /> },
  { key: "issuer", title: "Issuer", desc: "Issue signed credentials to holders.", icon: <FileSignature className="h-5 w-5" /> },
  { key: "verifier", title: "Verifier", desc: "Request and verify presentations.", icon: <ScanLine className="h-5 w-5" /> },
];

export default function RoleSelection() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role | null>(null);
  const [accountType, setAccountType] = useState<AccountType>("individual");

  const identity = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("qsdid.identity") || "null") as
        | { did: string; walletAddress: string }
        | null;
    } catch {
      return null;
    }
  }, []);

  const onContinue = () => {
    if (!role || !identity) return;
    const updated = { ...identity, role, accountType };
    sessionStorage.setItem("qsdid.identity", JSON.stringify(updated));
    audit("SUCCESS", "Role selected", { role, accountType });
    if (role === "holder") {
      navigate("/holder");
    } else {
      const params = new URLSearchParams({
        role,
        type: accountType,
        wallet: identity.walletAddress,
      });
      navigate(`/registration?${params.toString()}`);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(hsl(var(--primary)/0.03)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-primary/5 blur-[100px]" />

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 w-full max-w-xl"
      >
        <div className="rounded-2xl border border-border/60 bg-card/80 shadow-lg backdrop-blur-xl">
          <div className="flex flex-col items-center gap-2 border-b border-border/40 px-6 pt-7 pb-5">
            <div className="flex items-center gap-2">
              <img src={logo} alt="QS·DID" className="h-9 w-9" />
              <span className="text-xl font-bold tracking-tight text-foreground">
                QS<span className="text-primary">·</span>DID
              </span>
            </div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Choose your role
            </p>
          </div>

          <div className="px-6 py-6">
            {identity?.did && (
              <div className="mb-4 rounded-md border border-border/60 bg-secondary/30 p-3 text-[11px]">
                <div className="font-semibold uppercase tracking-wider text-muted-foreground">DID</div>
                <code className="mt-1 block break-all font-mono text-foreground">{identity.did}</code>
              </div>
            )}

            <div className="space-y-2">
              {roles.map((r) => {
                const active = role === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setRole(r.key)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/30 hover:border-primary/40"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        active ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
                      }`}
                    >
                      {r.icon}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm font-semibold ${active ? "text-foreground" : "text-foreground"}`}>
                        {r.title}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {role && role !== "holder" && (
              <div className="mt-5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Account type
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: "individual" as const, label: "Individual", icon: <User className="h-4 w-4" /> },
                      { key: "organization" as const, label: "Organization", icon: <Building2 className="h-4 w-4" /> },
                    ]
                  ).map((t) => {
                    const active = accountType === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setAccountType(t.key)}
                        className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t.icon}
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button onClick={onContinue} disabled={!role} className="mt-6 w-full">
              <ShieldCheck className="mr-2 h-4 w-4" />
              {role === "holder" ? "Enter app" : "Continue to registration"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
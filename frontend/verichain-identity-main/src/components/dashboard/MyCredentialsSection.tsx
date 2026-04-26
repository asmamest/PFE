import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Search,
  Filter,
  ExternalLink,
  Share2,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  X,
  Copy,
  Lock,
  Unlock,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

type CredentialStatus = "active" | "pending" | "revoked" | "expired";

interface Credential {
  id: string;
  name: string;
  issuer: string;
  issuedDate: string;
  expiryDate?: string;
  status: CredentialStatus;
  cid?: string;
  aiVerified?: boolean;
  attributes: Record<string, string>;
  signature?: string;
  verificationTag?: string;
}

const mockCredentials: Credential[] = [
  {
    id: "1",
    name: "National ID Card",
    issuer: "Government of France",
    issuedDate: "2024-01-15",
    expiryDate: "2034-01-15",
    status: "active",
    cid: "QmX7b4DAzEfmJEpG7oYRevdBWj9dVKXaCqXiaKUyKE5Pmq",
    aiVerified: true,
    attributes: { "Full Name": "Alice Dupont", "Date of Birth": "1995-03-12", "ID Number": "FR-9847362" },
    signature: "0x3a7f...c9d2",
    verificationTag: "sha256:a1b2c3d4e5f6",
  },
  {
    id: "2",
    name: "Master's Degree",
    issuer: "Université Paris-Saclay",
    issuedDate: "2023-09-01",
    status: "active",
    cid: "QmPZ9gCmGNi5zuKaeDSk3eHYdJwBmVDe1dKi2SDRFE7tPz",
    attributes: { "Degree": "M.Sc. Computer Science", "Student ID": "STU-20210456", "GPA": "3.87" },
    signature: "0x8b2e...f4a1",
  },
  {
    id: "3",
    name: "Employment Certificate",
    issuer: "Acme Corp",
    issuedDate: "2024-06-01",
    expiryDate: "2025-06-01",
    status: "pending",
    attributes: { "Position": "Software Engineer", "Department": "R&D" },
  },
  {
    id: "4",
    name: "Driver's License",
    issuer: "Préfecture de Paris",
    issuedDate: "2020-05-20",
    expiryDate: "2024-05-20",
    status: "expired",
    attributes: { "License Number": "DL-FR-884512", "Category": "B" },
  },
  {
    id: "5",
    name: "Previous Employment",
    issuer: "OldCo Ltd",
    issuedDate: "2019-01-01",
    expiryDate: "2022-12-31",
    status: "revoked",
    attributes: { "Position": "Intern", "Reason": "Company dissolved" },
  },
];

export function MyCredentialsSection() {
  const [filter, setFilter] = useState<"all" | CredentialStatus>("all");
  const [search, setSearch] = useState("");
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [shareModal, setShareModal] = useState<Credential | null>(null);
  const [shareType, setShareType] = useState<"full" | "selective">("full");
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);

  const filtered = mockCredentials.filter((c) => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.issuer.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filterTabs: { value: "all" | CredentialStatus; label: string; count: number }[] = [
    { value: "all", label: "All", count: mockCredentials.length },
    { value: "active", label: "Active", count: mockCredentials.filter((c) => c.status === "active").length },
    { value: "pending", label: "Pending", count: mockCredentials.filter((c) => c.status === "pending").length },
    { value: "expired", label: "Expired", count: mockCredentials.filter((c) => c.status === "expired").length },
    { value: "revoked", label: "Revoked", count: mockCredentials.filter((c) => c.status === "revoked").length },
  ];

  const handleShare = () => {
    if (!shareModal) return;
    if (shareType === "full") {
      const link = `https://verify.qsdid.io/${shareModal.cid || shareModal.id}`;
      navigator.clipboard.writeText(link);
      toast({ title: "Share link copied", description: "Full presentation link has been copied to clipboard." });
    } else {
      toast({
        title: "ZKP proof generated",
        description: `Selective disclosure proof created for ${selectedAttributes.length} attribute(s). Link copied.`,
      });
    }
    setShareModal(null);
    setSelectedAttributes([]);
  };

  const avatarUrl = (issuer: string) =>
    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(issuer)}&backgroundColor=4F46E5`;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Credentials</h1>
        <p className="text-sm text-muted-foreground">View, manage, and share your verifiable credentials.</p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search credentials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          {filterTabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              {t.label}
              <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">{t.count}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Credential Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((cred) => (
            <motion.div
              key={cred.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img src={avatarUrl(cred.issuer)} alt={cred.issuer} className="h-10 w-10 rounded-full" />
                      <div>
                        <h4 className="text-sm font-semibold text-card-foreground">{cred.name}</h4>
                        <p className="text-xs text-muted-foreground">{cred.issuer}</p>
                      </div>
                    </div>
                    <StatusBadge status={cred.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Issued: {cred.issuedDate}</span>
                    {cred.expiryDate && <span>Expires: {cred.expiryDate}</span>}
                  </div>
                  {cred.aiVerified && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      AI Verified
                    </span>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedCredential(cred)} className="gap-1 text-xs">
                      <Eye className="h-3 w-3" /> Details
                    </Button>
                    {cred.status === "active" && (
                      <Button variant="ghost" size="sm" onClick={() => setShareModal(cred)} className="gap-1 text-xs">
                        <Share2 className="h-3 w-3" /> Share
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mb-2" />
          <p className="text-sm">No credentials found.</p>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedCredential} onOpenChange={() => setSelectedCredential(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {selectedCredential?.name}
            </DialogTitle>
            <DialogDescription>{selectedCredential?.issuer}</DialogDescription>
          </DialogHeader>
          {selectedCredential && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedCredential.status} />
                {selectedCredential.aiVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    AI Verified
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attributes</h4>
                {Object.entries(selectedCredential.attributes).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-sm border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-medium text-foreground">{val}</span>
                  </div>
                ))}
              </div>
              {selectedCredential.signature && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Signature</h4>
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 font-mono text-xs">
                    <span>{selectedCredential.signature}</span>
                    <CopyButton value={selectedCredential.signature} />
                  </div>
                </div>
              )}
              {selectedCredential.cid && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">IPFS CID</h4>
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 font-mono text-xs">
                    <span className="truncate max-w-[280px]">{selectedCredential.cid}</span>
                    <CopyButton value={selectedCredential.cid} />
                  </div>
                </div>
              )}
              {selectedCredential.verificationTag && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Verification Tag</h4>
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 font-mono text-xs">
                    <span>{selectedCredential.verificationTag}</span>
                    <CopyButton value={selectedCredential.verificationTag} />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedCredential?.status === "active" && (
              <Button onClick={() => { setShareModal(selectedCredential); setSelectedCredential(null); }} className="gap-1.5">
                <Share2 className="h-4 w-4" /> Share Credential
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <Dialog open={!!shareModal} onOpenChange={() => { setShareModal(null); setSelectedAttributes([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Share Credential
            </DialogTitle>
            <DialogDescription>Choose how to share "{shareModal?.name}"</DialogDescription>
          </DialogHeader>
          {shareModal && (
            <div className="space-y-4">
              <Tabs value={shareType} onValueChange={(v) => setShareType(v as "full" | "selective")}>
                <TabsList className="w-full">
                  <TabsTrigger value="full" className="flex-1 gap-1.5">
                    <Unlock className="h-3.5 w-3.5" />
                    Full Presentation
                  </TabsTrigger>
                  <TabsTrigger value="selective" className="flex-1 gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Selective (ZKP)
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {shareType === "full" ? (
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  <p>A verification link containing the full CID will be generated. The verifier can see all credential attributes.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Select attributes to reveal via zero-knowledge proof:</p>
                  {Object.keys(shareModal.attributes).map((attr) => (
                    <label key={attr} className="flex items-center gap-2 rounded-lg border border-border/60 p-2.5 cursor-pointer hover:bg-secondary/40 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedAttributes.includes(attr)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedAttributes([...selectedAttributes, attr]);
                          else setSelectedAttributes(selectedAttributes.filter((a) => a !== attr));
                        }}
                        className="rounded border-border"
                      />
                      <span className="text-sm text-foreground">{attr}</span>
                    </label>
                  ))}
                  <div className="rounded-lg bg-accent/10 p-3 text-xs text-accent-foreground">
                    <p>A WASM-generated zero-knowledge proof will be created. Only selected attributes are revealed.</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShareModal(null); setSelectedAttributes([]); }}>
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={shareType === "selective" && selectedAttributes.length === 0}
              className="gap-1.5"
            >
              <Copy className="h-4 w-4" />
              {shareType === "full" ? "Copy Link" : "Generate ZKP Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

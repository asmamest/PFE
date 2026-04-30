import { useState } from "react";
import { Search, Eye, Share2, Lock, Unlock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { Credential } from "@/lib/holder/credentialService";

interface MyCredentialsSectionProps {
  credentials: Credential[];
  loading?: boolean;
}

export function MyCredentialsSection({ credentials, loading }: MyCredentialsSectionProps) {
  const [search, setSearch] = useState("");
  const [selectedCred, setSelectedCred] = useState<Credential | null>(null);
  const [shareModal, setShareModal] = useState<Credential | null>(null);
  const [shareType, setShareType] = useState<"full" | "selective">("full");
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);

  const filtered = credentials.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.issuer.toLowerCase().includes(search.toLowerCase())
  );

  const handleShare = () => {
    if (!shareModal) return;
    if (shareType === "full") {
      const link = `https://verify.qsdid.io/${shareModal.cid || shareModal.ipfsCID}`;
      navigator.clipboard.writeText(link);
      toast({ title: "Share link copied", description: "Full presentation link has been copied." });
    } else {
      toast({
        title: "ZKP proof generated",
        description: `Selective disclosure proof created for ${selectedAttrs.length} attribute(s).`,
      });
    }
    setShareModal(null);
    setSelectedAttrs([]);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">My Credentials</h2>
        <p className="text-xs text-muted-foreground">View, manage, and share your verifiable credentials.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search credentials..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {filtered.map((cred) => (
          <div key={cred.id} className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm p-4 hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-foreground">{cred.name}</h3>
                <p className="text-xs text-muted-foreground">{cred.issuer}</p>
              </div>
              <StatusBadge status={cred.status} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground space-y-1">
              <p>Issued: {cred.issuedDate}</p>
              {cred.expiryDate && <p>Expires: {cred.expiryDate}</p>}
            </div>
            {cred.aiVerified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary mt-2">
                AI Verified
              </span>
            )}
            <div className="flex gap-2 mt-3">
              <Button variant="outline" size="sm" onClick={() => setSelectedCred(cred)}>View</Button>
              {cred.status === "active" && (
                <Button variant="outline" size="sm" onClick={() => setShareModal(cred)}>Share</Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!selectedCred} onOpenChange={() => setSelectedCred(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCred?.name}</DialogTitle>
          </DialogHeader>
          {selectedCred && (
            <div className="space-y-3">
              <p><strong>Issuer:</strong> {selectedCred.issuer}</p>
              <p><strong>Issued:</strong> {selectedCred.issuedDate}</p>
              {selectedCred.expiryDate && <p><strong>Expires:</strong> {selectedCred.expiryDate}</p>}
              <div><strong>Attributes:</strong></div>
              {Object.entries(selectedCred.attributes).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-border/40 py-1">
                  <span>{k}:</span> <span className="font-mono">{v}</span>
                </div>
              ))}
              <p><strong>CID:</strong> <code className="text-xs">{selectedCred.ipfsCID || selectedCred.cid}</code></p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!shareModal} onOpenChange={() => setShareModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share "{shareModal?.name}"</DialogTitle>
          </DialogHeader>
          {shareModal && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button onClick={() => setShareType("full")} className={`flex-1 py-2 rounded-lg border ${shareType === "full" ? "bg-primary/10 border-primary text-primary" : "border-border"}`}>
                  <Unlock className="inline h-4 w-4 mr-1" /> Full
                </button>
                <button onClick={() => setShareType("selective")} className={`flex-1 py-2 rounded-lg border ${shareType === "selective" ? "bg-primary/10 border-primary text-primary" : "border-border"}`}>
                  <Lock className="inline h-4 w-4 mr-1" /> Selective (ZKP)
                </button>
              </div>
              {shareType === "selective" && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Attributes to reveal:</p>
                  {Object.keys(shareModal.attributes).map(attr => (
                    <label key={attr} className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedAttrs.includes(attr)} onChange={(e) => {
                        if (e.target.checked) setSelectedAttrs([...selectedAttrs, attr]);
                        else setSelectedAttrs(selectedAttrs.filter(a => a !== attr));
                      }} />
                      {attr}
                    </label>
                  ))}
                </div>
              )}
              <Button onClick={handleShare} disabled={shareType === "selective" && selectedAttrs.length === 0}>
                Generate {shareType === "full" ? "Share Link" : "ZKP Proof"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
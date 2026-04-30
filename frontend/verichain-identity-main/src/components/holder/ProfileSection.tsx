// src/components/holder/ProfileSection.tsx
import { useState } from "react";
import { User, Copy, Download, Eye, EyeOff, Key, Fingerprint, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/CopyButton";
import { toast } from "@/hooks/use-toast";

interface ProfileSectionProps {
  walletAddress: string;
  did: string;
  publicKey?: string;
}

export function ProfileSection({ walletAddress, did, publicKey }: ProfileSectionProps) {
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [editing, setEditing] = useState(false);


  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Profile</h2>
        <p className="text-xs text-muted-foreground">Manage your identity and cryptographic keys.</p>
      </div>

      {/* Display name */}
      <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
        <div className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Display Name</div>
        {!editing ? (
          <div className="flex justify-between items-center">
            <span>{displayName || "Not set"}</span>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
            <Button size="sm" onClick={() => setEditing(false)}>Save</Button>
          </div>
        )}
      </div>

      {/* Wallet & DID */}
      <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
        <div className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-primary" /> Wallet Address</div>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-secondary/50 p-2 rounded flex-1 truncate">{walletAddress}</code>
          <CopyButton value={walletAddress} />
        </div>
        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-accent" /> Decentralized Identifier</div>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-secondary/50 p-2 rounded flex-1 truncate">{did}</code>
          <CopyButton value={did} />
        </div>
        {publicKey && (
          <>
            <div className="flex items-center gap-2"><Key className="h-4 w-4" /> Public Key (Base64)</div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-secondary/50 p-2 rounded flex-1 truncate">{publicKey}</code>
              <CopyButton value={publicKey} />
            </div>
          </>
        )}
      </div>

    </div>
  );
}
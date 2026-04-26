import { useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Copy,
  Download,
  Eye,
  EyeOff,
  Edit3,
  Shield,
  Key,
  Fingerprint,
  Save,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/CopyButton";
import { WalletAddress } from "@/components/ui/WalletAddress";
import { DIDDisplay } from "@/components/ui/DIDDisplay";
import { toast } from "@/hooks/use-toast";

interface ProfileSectionProps {
  walletAddress: string;
}

export function ProfileSection({ walletAddress }: ProfileSectionProps) {
  const did = `did:zk:${walletAddress}`;
  const publicKey = btoa(walletAddress).slice(0, 44) + "==";
  const privateKeyFull = "ad5f8c7e2b1d9a3f6e4c8b0d7a2e5f9c1b3d8a6e4f7c2a0b9d5e3f1c8a6b4d";
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [editName, setEditName] = useState("");

  const handleSaveProfile = () => {
    setDisplayName(editName);
    setEditing(false);
    toast({ title: "Profile updated", description: "Your display name has been saved locally." });
  };

  const handleDownloadKey = () => {
    toast({
      title: "Biometric confirmation required",
      description: "Please confirm your identity to download the private key.",
    });
    // Simulate biometric delay
    setTimeout(() => {
      const blob = new Blob([privateKeyFull], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qs-did-private-key.txt";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Private key downloaded", description: "Store it securely offline." });
    }, 1500);
  };

  const infoRows = [
    {
      label: "Wallet Address",
      icon: <Fingerprint className="h-4 w-4 text-primary" />,
      content: <WalletAddress address={walletAddress} />,
    },
    {
      label: "Decentralized Identifier (DID)",
      icon: <Shield className="h-4 w-4 text-accent" />,
      content: <DIDDisplay did={did} />,
    },
    {
      label: "Public Key (Base64)",
      icon: <Key className="h-4 w-4 text-muted-foreground" />,
      content: (
        <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 font-mono text-xs">
          <span className="truncate max-w-[220px]">{publicKey}</span>
          <CopyButton value={publicKey} />
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your identity and cryptographic keys.</p>
      </div>

      {/* Identity Info */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Identity Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {infoRows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {row.icon}
                {row.label}
              </div>
              {row.content}
            </div>
          ))}

          {/* Private Key */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Key className="h-4 w-4 text-destructive" />
              Private Key
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 font-mono text-xs">
                <span>{showPrivateKey ? privateKeyFull : `${privateKeyFull.slice(0, 6)}...${privateKeyFull.slice(-4)}`}</span>
                <button
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPrivateKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadKey} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-primary" />
            Display Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!editing ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {displayName || "No display name set"}
                </p>
                <p className="text-xs text-muted-foreground">Stored locally on this device</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditName(displayName);
                  setEditing(true);
                }}
                className="gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Profile
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Display name"
                className="max-w-xs"
              />
              <Button size="sm" onClick={handleSaveProfile} className="gap-1">
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  FileText,
  Share2,
  Download,
  Shield,
  Loader2,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  type: "credential_received" | "verification_request" | "status_change";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "credential_received",
    title: "New credential received",
    description: 'Master\'s Degree from Université Paris-Saclay has been issued to your wallet.',
    timestamp: "2 hours ago",
    read: false,
  },
  {
    id: "2",
    type: "verification_request",
    title: "Verification request",
    description: "A verifier has checked your National ID Card credential via the shared link.",
    timestamp: "5 hours ago",
    read: false,
  },
  {
    id: "3",
    type: "status_change",
    title: "Credential status updated",
    description: 'Employment Certificate from Acme Corp status changed to "Active".',
    timestamp: "1 day ago",
    read: true,
  },
  {
    id: "4",
    type: "credential_received",
    title: "New credential received",
    description: "Vaccination Record from CertiHealth has been issued to your wallet.",
    timestamp: "3 days ago",
    read: true,
  },
];

const iconMap = {
  credential_received: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
  verification_request: <Share2 className="h-4 w-4 text-primary" />,
  status_change: <FileText className="h-4 w-4 text-amber-600" />,
};

export function NotificationsSection() {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [exporting, setExporting] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    toast({ title: "All notifications marked as read" });
  };

  const handleExportWallet = async () => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 2000));

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      credentials: 5,
      did: "did:zk:0x...",
      encrypted: true,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qs-did-wallet-backup.json";
    a.click();
    URL.revokeObjectURL(url);

    setExporting(false);
    toast({ title: "Wallet exported", description: "Encrypted backup has been downloaded." });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
            Mark all as read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-2">
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Card className={`transition-colors ${!notif.read ? "border-primary/20 bg-primary/[0.02]" : ""}`}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  {iconMap[notif.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${!notif.read ? "font-semibold" : "font-medium"} text-foreground`}>
                      {notif.title}
                    </p>
                    {!notif.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{notif.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{notif.timestamp}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Wallet Export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Wallet Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Export an encrypted backup of your entire wallet including all credentials and keys. The backup file is password-protected.
          </p>
          <Button onClick={handleExportWallet} disabled={exporting} variant="outline" className="gap-1.5">
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> Export Wallet Backup
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

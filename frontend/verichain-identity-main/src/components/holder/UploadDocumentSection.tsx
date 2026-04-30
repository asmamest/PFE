// src/components/holder/UploadDocumentSection.tsx
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Loader2, CheckCircle2, AlertTriangle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";

export function UploadDocumentSection() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [cid, setCid] = useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setCid(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    // Simulate upload & AI check
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 200));
      setProgress(i);
    }
    // Simulate success (80% authentic)
    const isAuthentic = Math.random() > 0.2;
    if (isAuthentic) {
      const fakeCid = "Qm" + Math.random().toString(36).substring(2, 15);
      setCid(fakeCid);
      setResult("success");
      toast({ title: "Document verified", description: "The document is authentic and stored on IPFS." });
    } else {
      setResult("error");
      toast({ title: "Document flagged", description: "Potential fraud detected.", variant: "destructive" });
    }
    setUploading(false);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setCid(null);
    setProgress(0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Upload Document</h2>
        <p className="text-xs text-muted-foreground">Upload a document for AI verification and IPFS storage.</p>
      </div>

      <div className="rounded-xl border-2 border-dashed border-border/60 p-8 text-center cursor-pointer hover:border-primary/40 transition-colors" onClick={() => document.getElementById("file-upload")?.click()}>
        <input id="file-upload" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
        <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium">Drag & drop or click to upload</p>
        <p className="text-xs text-muted-foreground mt-1">Supports images and PDF</p>
      </div>

      {file && !uploading && !result && (
        <div>
          <p className="text-sm mb-2">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
          <Button onClick={handleUpload} className="w-full gap-2"><Shield className="h-4 w-4" /> Analyze with EdgeDoc AI</Button>
        </div>
      )}

      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Analyzing document...</div>
          <Progress value={progress} />
        </div>
      )}

      {result === "success" && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-500 mb-2" />
          <p className="font-medium">Document Verified</p>
          <p className="text-xs text-muted-foreground mt-1">The document is authentic. Stored on IPFS with CID: <code className="text-xs">{cid}</code></p>
          <Button variant="outline" size="sm" onClick={reset} className="mt-3">Upload Another</Button>
        </div>
      )}

      {result === "error" && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-red-500 mb-2" />
          <p className="font-medium">Potential Fraud Detected</p>
          <p className="text-xs text-muted-foreground mt-1">The document contains suspicious elements. Please try another file.</p>
          <Button variant="outline" size="sm" onClick={reset} className="mt-3">Try Again</Button>
        </div>
      )}
    </div>
  );
}
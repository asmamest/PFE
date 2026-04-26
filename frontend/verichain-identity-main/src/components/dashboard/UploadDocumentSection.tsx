import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileImage,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Shield,
  Eye,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";

type AnalysisState = "idle" | "uploading" | "analyzing" | "result";
type AnalysisResult = "authentic" | "suspicious" | null;

export function UploadDocumentSection() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [progress, setProgress] = useState(0);
  const [fraudScore, setFraudScore] = useState<number | null>(null);
  const [result, setResult] = useState<AnalysisResult>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setAnalysisState("idle");
    setResult(null);
    setFraudScore(null);
    setCid(null);

    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const handleAnalyze = async () => {
    if (!file) return;

    setAnalysisState("uploading");
    setProgress(0);

    // Simulate upload
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((r) => setTimeout(r, 120));
      setProgress(i);
    }

    setAnalysisState("analyzing");
    setProgress(0);

    // Simulate AI analysis
    for (let i = 0; i <= 100; i += 5) {
      await new Promise((r) => setTimeout(r, 100));
      setProgress(i);
    }

    // Random result (80% chance authentic)
    const score = Math.random() * 100;
    setFraudScore(score);

    if (score < 15) {
      setResult("authentic");
      const mockCid = "Qm" + Array.from({ length: 44 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 62)]).join("");
      setCid(mockCid);
      toast({ title: "Document verified", description: "Document is authentic. Stored on IPFS and added to your credentials." });
    } else {
      setResult("suspicious");
      toast({ title: "Document flagged", description: "Potential fraud detected. Please review or try another document.", variant: "destructive" });
    }

    setAnalysisState("result");
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setAnalysisState("idle");
    setProgress(0);
    setFraudScore(null);
    setResult(null);
    setCid(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload Document</h1>
        <p className="text-sm text-muted-foreground">Upload a document for AI verification and IPFS storage.</p>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardContent className="p-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => { if (analysisState === "idle") document.getElementById("file-upload")?.click(); }}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : file
                ? "border-border bg-secondary/20"
                : "border-border/60 hover:border-primary/40 hover:bg-secondary/20"
            }`}
          >
            <input
              id="file-upload"
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            {!file ? (
              <>
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground">Drag & drop your document here</p>
                <p className="text-xs text-muted-foreground mt-1">Supports images and PDF files</p>
              </>
            ) : (
              <div className="flex items-center gap-3 w-full">
                {preview ? (
                  <img src={preview} alt="Preview" className="h-16 w-16 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                {analysisState === "idle" && (
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); reset(); }}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {file && analysisState === "idle" && (
            <Button onClick={handleAnalyze} className="w-full mt-4 gap-1.5">
              <Shield className="h-4 w-4" />
              Analyze with EdgeDoc AI
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Analysis Progress */}
      <AnimatePresence>
        {(analysisState === "uploading" || analysisState === "analyzing") && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {analysisState === "uploading" ? "Uploading document..." : "AI analysis in progress..."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {analysisState === "uploading" ? "Encrypting and uploading to secure storage" : "EdgeDoc is scanning for fraud indicators"}
                    </p>
                  </div>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">{progress}%</p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {analysisState === "result" && fraudScore !== null && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className={result === "authentic" ? "border-emerald-200" : "border-destructive/30"}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {result === "authentic" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  )}
                  {result === "authentic" ? "Document Verified" : "Suspicious Document"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Fraud Score */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Fraud Score</span>
                    <span className={`font-mono font-bold ${fraudScore < 15 ? "text-emerald-600" : "text-destructive"}`}>
                      {fraudScore.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${fraudScore}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full rounded-full ${fraudScore < 15 ? "bg-emerald-500" : fraudScore < 50 ? "bg-amber-500" : "bg-destructive"}`}
                    />
                  </div>
                </div>

                {/* Heatmap placeholder */}
                {preview && (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img src={preview} alt="Analysis" className="w-full max-h-48 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-background/90 px-2 py-1 text-[10px] font-medium">
                      <Eye className="h-3 w-3 text-primary" />
                      AI Heatmap Analysis
                    </div>
                  </div>
                )}

                {result === "authentic" ? (
                  <div className="space-y-2">
                    <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                      <p className="font-medium">Document is authentic.</p>
                      <p className="mt-1">Encrypted and stored on IPFS. Added to your credentials as "Active" with an "AI Verified" label.</p>
                    </div>
                    {cid && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">CID:</span>
                        <code className="rounded bg-muted px-2 py-1 font-mono text-xs truncate max-w-[300px]">{cid}</code>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                      <p className="font-medium">Potential fraud detected.</p>
                      <p className="mt-1">The document contains suspicious elements. Please try uploading a different file or request a manual review.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                        <RotateCcw className="h-3.5 w-3.5" /> Try Another File
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast({ title: "Manual review requested", description: "An administrator will review your document." })}>
                        Request Manual Review
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

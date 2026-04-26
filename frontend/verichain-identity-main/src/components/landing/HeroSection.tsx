import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  Fingerprint,
  Lock,
  Wallet,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import facePhoto from "@/assets/face-photo.jfif"; // ← remplace par le bon chemin/nom de fichier

// ─── Scan line animée ─────────────────────────────────────────────────────────
function ScanLine() {
  return (
    <motion.div
      className="pointer-events-none absolute left-0 right-0 z-10"
      style={{
        height: 2,
        background:
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 50%, transparent 100%)",
      }}
      animate={{ top: [88, 340] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ─── Coins du cadre de scan ───────────────────────────────────────────────────
function ScanBrackets() {
  const corners = [
    { top: 88,  left: "calc(50% - 80px)", borderTop: true,    borderLeft: true,  borderRadius: "4px 0 0 0" },
    { top: 88,  left: "calc(50% + 46px)", borderTop: true,    borderRight: true, borderRadius: "0 4px 0 0" },
    { top: 290, left: "calc(50% - 80px)", borderBottom: true, borderLeft: true,  borderRadius: "0 0 0 4px" },
    { top: 290, left: "calc(50% + 46px)", borderBottom: true, borderRight: true, borderRadius: "0 0 4px 0" },
  ];

  return (
    <>
      {corners.map((c, i) => (
        <div
          key={i}
          className="absolute z-10"
          style={{
            top: c.top,
            left: c.left,
            width: 34,
            height: 34,
            borderRadius: c.borderRadius,
            borderTop:    c.borderTop    ? "2.5px solid rgba(255,255,255,0.9)" : undefined,
            borderBottom: c.borderBottom ? "2.5px solid rgba(255,255,255,0.9)" : undefined,
            borderLeft:   c.borderLeft   ? "2.5px solid rgba(255,255,255,0.9)" : undefined,
            borderRight:  c.borderRight  ? "2.5px solid rgba(255,255,255,0.9)" : undefined,
          }}
        />
      ))}
    </>
  );
}

// ─── Téléphone ────────────────────────────────────────────────────────────────
function PhoneMockup() {
  return (
    <div className="relative" style={{ width: 224, height: 450 }}>

      {/* Shell */}
      <div
        className="absolute inset-0 rounded-[38px] p-[3px]"
        style={{
          background: "#e5e7ea",
          boxShadow:
            "0 2px 0 #c4c6c9, 0 4px 0 #aeaeb2, 0 6px 0 #98989c, 0 10px 30px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,255,255,0.85)",
        }}
      >
        {/* Bezel */}
        <div
          className="relative h-full w-full overflow-hidden rounded-[36px]"
          style={{ background: "#0d0d0d" }}
        >
          {/* Dynamic Island */}
          <div
            className="absolute left-1/2 -translate-x-1/2 z-20"
            style={{ top: 11, width: 74, height: 21, background: "#000", borderRadius: 13 }}
          />

          {/* Status bar */}
          <div
            className="absolute left-0 right-0 z-20 flex items-end justify-between px-4"
            style={{ top: 0, height: 38, paddingBottom: 5 }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: -0.3 }}>
              9:41
            </span>
            <div className="flex items-center gap-1">
              {/* Signal */}
              <svg width="17" height="12" viewBox="0 0 17 12">
                <rect x="0"    y="8" width="3" height="4"  rx=".6" fill="white" />
                <rect x="4.5"  y="5" width="3" height="7"  rx=".6" fill="white" />
                <rect x="9"    y="2" width="3" height="10" rx=".6" fill="white" />
                <rect x="13.5" y="0" width="3" height="12" rx=".6" fill="white" />
              </svg>
              {/* Batterie */}
              <svg width="25" height="12" viewBox="0 0 25 12">
                <rect x="0" y="1" width="21" height="10" rx="2.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1" fill="none" />
                <rect x="21.5" y="3.5" width="3" height="5" rx="1.2" fill="rgba(255,255,255,0.5)" />
                <rect x="1.5" y="2.5" width="15" height="7" rx="1.5" fill="white" />
              </svg>
            </div>
          </div>

          {/* App header "Scanning" */}
          <div
            className="absolute left-0 right-0 z-10 flex items-center justify-between px-4"
            style={{ top: 38 }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", letterSpacing: "0.01em" }}>
              Scanning
            </span>
            <div className="flex flex-col items-end gap-[3px]">
              <div style={{ width: 14, height: 2, background: "#fff", borderRadius: 1 }} />
              <div style={{ width: 10, height: 2, background: "#fff", borderRadius: 1 }} />
              <div style={{ width: 14, height: 2, background: "#fff", borderRadius: 1 }} />
            </div>
          </div>

          {/* ── Photo réelle en plein écran ── */}
          <img
            src={facePhoto}
            alt="Face scan"
            className="absolute inset-0 h-full w-full"
            style={{ objectFit: "cover", objectPosition: "center top" }}
          />

          {/* Vignette bas pour contraste */}
          <div
            className="absolute bottom-0 left-0 right-0 z-[5]"
            style={{
              height: 130,
              background: "linear-gradient(to top, rgba(0,0,0,0.50), transparent)",
            }}
          />

          {/* Scan line + brackets */}
          <ScanLine />
          <ScanBrackets />

          {/* Shutter */}
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center rounded-full"
            style={{
              width: 48,
              height: 48,
              background: "rgba(255,255,255,0.22)",
              border: "2.5px solid rgba(255,255,255,0.8)",
            }}
          >
            <div
              className="rounded-full"
              style={{ width: 34, height: 34, background: "rgba(255,255,255,0.85)" }}
            />
          </div>
        </div>
      </div>

      {/* Boutons latéraux gauche */}
      <div className="absolute rounded-l-sm" style={{ top: 118, left: -3, width: 3, height: 28, background: "#c0c2c4" }} />
      <div className="absolute rounded-l-sm" style={{ top: 155, left: -3, width: 3, height: 46, background: "#c0c2c4" }} />
      <div className="absolute rounded-l-sm" style={{ top: 210, left: -3, width: 3, height: 46, background: "#c0c2c4" }} />
      {/* Bouton droit */}
      <div className="absolute rounded-r-sm" style={{ top: 155, right: -3, width: 3, height: 62, background: "#c0c2c4" }} />
    </div>
  );
}

// ─── Carte ID overlay ─────────────────────────────────────────────────────────
function IdCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.6, type: "spring", stiffness: 200, damping: 22 }}
      className="absolute rounded-xl border bg-card p-3"
      style={{
        bottom: 16,
        left: -76,
        width: 196,
        boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {/* Avatar + nom */}
      <div className="mb-2.5 flex items-center gap-2.5">
        <img
          src={facePhoto}
          alt="Profile"
          className="h-8 w-8 rounded-full object-cover"
        />

        <div>
          <p className="text-[12px] font-semibold text-foreground leading-tight">Ralph Edwards</p>
          <p className="text-[10px] text-muted-foreground">03/06/2002</p>
        </div>
      </div>

      {/* Séparateur */}
      <div className="mb-2 h-px bg-border" />

      {/* Champs */}
      <p className="mb-1 text-[8px] uppercase tracking-widest text-muted-foreground">
        Verification date
      </p>
      <div className="mb-1 h-2 w-4/5 rounded bg-muted" />
      <p className="mb-2 font-mono text-[11px] font-semibold tracking-wide text-foreground">
        0 5 / 0 4 / 2 0 2 6
      </p>

      {/* Code MRZ */}
      <div className="rounded bg-muted px-2 py-1">
        <p className="font-mono text-[8px] tracking-wider text-muted-foreground">
          AB-07-443YFY3-XF34-4*MR*
        </p>
      </div>
    </motion.div>
  );
}

// ─── HeroAnimation — remplace l'ancienne fonction ────────────────────────────
function HeroAnimation() {
  return (
    <div
      className="relative mx-auto flex h-[480px] w-full max-w-md items-center justify-center overflow-visible rounded-2xl border bg-card"
      style={{ boxShadow: "var(--shadow-elevated)" }}
    >
      {/* Halo ambiant */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background:
            "radial-gradient(ellipse at 60% 40%, hsl(220 90% 56% / 0.07) 0%, transparent 70%)",
        }}
      />

      {/* Téléphone + carte ID */}
      <div className="relative">
        <PhoneMockup />
        <IdCard />
      </div>
    </div>
  );
}

// ─── HeroSection ─────────────────────────────────────────────────────────────
export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Fond dégradé */}
      <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
      <div className="absolute -top-40 -right-40 -z-10 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 -z-10 h-[500px] w-[500px] rounded-full bg-accent/5 blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">

          {/* ── Colonne gauche ── */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-primary shadow-sm">
              <Shield className="h-3 w-3" /> Self-Sovereign Identity Platform
            </span>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Own Your
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                {" "}Digital Identity
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Issue, hold, and verify decentralized credentials with AI-powered fraud detection,
              zero-knowledge proofs, and blockchain-backed trust — no intermediaries required.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="gap-2" onClick={() => window.location.href = "/onboarding"}>
                Connect Wallet <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="gap-2">
                Learn More
              </Button>
            </div>

            <div className="mt-10 flex items-center gap-6">
              {[
                { icon: Shield,      label: "Zero-Knowledge Proofs" },
                { icon: Lock,        label: "End-to-End Encrypted" },
                { icon: Fingerprint, label: "AI Fraud Detection" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon className="h-4 w-4 text-primary" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Colonne droite — mockup téléphone ── */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <HeroAnimation />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
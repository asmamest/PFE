import { motion } from "framer-motion";
import {
  Shield,
  Fingerprint,
  Lock,
  FileCheck,
  Share2,
  ScanFace,
} from "lucide-react";

const features = [
  {
    icon: Fingerprint,
    title: "Decentralized Identity",
    description:
      "Create and manage your DID anchored to the blockchain.",
  },
  {
    icon: Shield,
    title: "Zero-Knowledge Proofs",
    description:
      "Prove attributes without exposing raw data.",
  },
  {
    icon: ScanFace,
    title: "AI Fraud Detection",
    description:
      "AI-powered document verification with visual analysis.",
  },
  {
    icon: Lock,
    title: "Encrypted Storage",
    description:
      "Secure credential storage with full user ownership.",
  },
  {
    icon: FileCheck,
    title: "Verifiable Credentials",
    description:
      "Cryptographically signed and instantly verifiable.",
  },
  {
    icon: Share2,
    title: "Selective Disclosure",
    description:
      "Share only what’s needed with precision control.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4">

        {/* Header */}
        <div className="text-center">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground">
            Built for real digital identity
          </h2>
          <p className="mt-4 text-muted-foreground">
            Minimal, secure and designed for control.
          </p>
        </div>

        {/* LIST STYLE (pas grid) */}
        <div className="mt-16 divide-y border-t border-b">

          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              viewport={{ once: true }}
              className="group flex items-start gap-6 py-8 transition-all duration-300 hover:bg-muted/40"
            >
              {/* ICON MINIMAL */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-all group-hover:bg-primary/10">
                <f.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </div>

              {/* CONTENT */}
              <div className="flex-1">
                <h3 className="text-base font-semibold text-foreground">
                  {f.title}
                </h3>

                <p className="mt-1 text-sm text-muted-foreground max-w-md">
                  {f.description}
                </p>
              </div>

              {/* ARROW INDICATOR */}
              <div className="opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                <span className="text-sm text-primary">→</span>
              </div>
            </motion.div>
          ))}

        </div>
      </div>
    </section>
  );
}
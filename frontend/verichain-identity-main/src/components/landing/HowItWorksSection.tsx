import { motion } from "framer-motion";
import { Wallet, UserCheck, FileCheck, Share2 } from "lucide-react";

const steps = [
  {
    icon: Wallet,
    title: "Connect Your Wallet",
    description: "Link your blockchain wallet to generate your unique Decentralized Identifier (DID) and cryptographic key pair.",
  },
  {
    icon: UserCheck,
    title: "Verify Your Identity",
    description: "Upload your ID document. Our AI model EdgeDoc analyzes it for authenticity with a fraud heatmap overlay.",
  },
  {
    icon: FileCheck,
    title: "Receive Credentials",
    description: "Request verifiable credentials from trusted issuers. Each credential is signed, encrypted, and stored on IPFS.",
  },
  {
    icon: Share2,
    title: "Share with Control",
    description: "Present credentials using zero-knowledge proofs. Reveal only the attributes needed — nothing more.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-sm font-semibold tracking-wide text-primary uppercase">How It Works</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Get started in four simple steps
          </h2>
        </div>

        <div className="relative mt-16">
          {/* Connector line */}
          <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-border lg:block" />

          <div className="space-y-12 lg:space-y-0">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className={`relative flex flex-col items-center gap-6 lg:flex-row ${
                  i % 2 === 0 ? "" : "lg:flex-row-reverse"
                } lg:gap-16`}
              >
                <div className={`flex-1 ${i % 2 === 0 ? "lg:text-right" : "lg:text-left"}`}>
                  <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">{step.description}</p>
                </div>

                {/* Circle */}
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-background bg-primary shadow-md">
                  <step.icon className="h-6 w-6 text-primary-foreground" />
                </div>

                <div className="flex-1" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

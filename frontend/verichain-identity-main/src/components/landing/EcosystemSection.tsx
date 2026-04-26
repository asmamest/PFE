import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import ecosystemFlow from "@/assets/ecosystem-flow.png";

const accordionItems = [
  {
    number: "01",
    title: "Onboard issuers and verifiers",
    content:
      "Register trusted organizations as credential issuers or verifiers within the QS·DID ecosystem. Each entity receives a unique DID anchored on-chain.",
  },
  {
    number: "02",
    title: "Establish trust in your ecosystem",
    content:
      "Define trust frameworks, credential schemas, and verification policies. Build a network of trusted participants with transparent governance.",
  },
  {
    number: "03",
    title: "Launch credential issuance and ZKP verification",
    content:
      "Start issuing verifiable credentials to holders and enable privacy-preserving verification through zero-knowledge proofs — no intermediaries needed.",
  },
];

export function EcosystemSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="ecosystem" className="py-20 sm:py-28 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left — Accordion */}
          <div>
            <span className="text-sm font-semibold tracking-wide text-primary">Ecosystem tooling</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-tight">
              Customize your ecosystem of issuers, holders and verifiers
            </h2>
            <p className="mt-5 text-base text-muted-foreground leading-relaxed">
              Make it easier and safer for people and organizations to share
              information with one another.
            </p>

            <div className="mt-10 divide-y divide-border">
              {accordionItems.map((item, i) => {
                const isOpen = openIndex === i;
                return (
                  <div key={item.number} className="py-5">
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <div className="flex items-baseline gap-4">
                        <span className="text-sm font-semibold text-primary">{item.number}</span>
                        <span className="text-base font-semibold text-foreground sm:text-lg">{item.title}</span>
                      </div>
                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <p className="mt-3 pl-8 text-sm leading-relaxed text-muted-foreground">
                            {item.content}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right — Ecosystem flow image */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center pt-16 lg:pt-24"
          >
            <img
              src={ecosystemFlow}
              alt="Ecosystem flow: Data source issues credentials to Holders who share with Relying Parties"
              className="w-full max-w-xl lg:max-w-2xl"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

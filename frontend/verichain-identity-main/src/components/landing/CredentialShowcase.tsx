import { motion } from "framer-motion";
import { CredentialCard } from "@/components/ui/CredentialCard";

const credentials = [
  {
    type: "Master's Degree — AI & Data Science",
    issuer: "University of Algiers",
    issuedDate: "2024-06-15",
    expiryDate: "2034-06-15",
    status: "active" as const,
    cid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    aiVerified: true,
  },
  {
    type: "Professional Driver's License",
    issuer: "Ministry of Transport",
    issuedDate: "2023-01-10",
    expiryDate: "2028-01-10",
    status: "active" as const,
    aiVerified: true,
  },
  {
    type: "National ID Card",
    issuer: "Civil Registry Office",
    issuedDate: "2020-03-22",
    expiryDate: "2030-03-22",
    status: "active" as const,
    cid: "QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX",
    aiVerified: true,
  },
  {
    type: "Health Insurance Certificate",
    issuer: "National Health Fund",
    issuedDate: "2022-09-01",
    status: "expired" as const,
  },
];

export function CredentialShowcase() {
  return (
    <section className="py-20 sm:py-28" style={{ background: "var(--gradient-hero)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-sm font-semibold tracking-wide text-primary uppercase">Credential Wallet</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Your credentials, always at hand
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Store, manage, and share verifiable credentials with AI-powered authenticity scores and on-chain proof.
          </p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
          className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {credentials.map((c) => (
            <motion.div key={c.type} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
              <CredentialCard {...c} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

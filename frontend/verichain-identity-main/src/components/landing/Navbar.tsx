import { useState } from "react";
import { motion } from "framer-motion";
import { Menu, X, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

export function Navbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Ecosystem", href: "#ecosystem" },
  ];

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2.5">
          <img src={logo} alt="QS·DID" className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight text-foreground">
            QS<span className="text-primary">·</span>DID
          </span>
        </a>

        {/* Desktop */}
        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </a>
          ))}
          <Button size="sm" onClick={() => window.location.href = "/onboarding"}>Connect Wallet</Button>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="border-t bg-background px-4 pb-4 md:hidden"
        >
          {links.map((l) => (
            <a key={l.href} href={l.href} className="block py-3 text-sm font-medium text-muted-foreground" onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Button size="sm" className="mt-2 w-full" onClick={() => window.location.href = "/onboarding"}>Connect Wallet</Button>
        </motion.div>
      )}
    </motion.nav>
  );
}

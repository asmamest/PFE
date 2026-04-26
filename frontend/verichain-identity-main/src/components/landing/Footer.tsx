import { Fingerprint } from "lucide-react";
import logo from "@/assets/logo.png";

export function Footer() {
  return (
    <footer className="border-t bg-card py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="QS·DID" className="h-7 w-7" />
            <span className="text-base font-bold tracking-tight text-foreground">
              QS<span className="text-primary">·</span>DID
            </span>
          </div>

          <div className="flex gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#ecosystem" className="hover:text-foreground transition-colors">Ecosystem</a>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} QS·DID — Final Year Project
          </p>
        </div>
      </div>
    </footer>
  );
}

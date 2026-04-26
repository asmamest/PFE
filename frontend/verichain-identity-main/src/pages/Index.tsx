import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { EcosystemSection } from "@/components/landing/EcosystemSection";
import { CredentialShowcase } from "@/components/landing/CredentialShowcase";
import { Footer } from "@/components/landing/Footer";


const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <FeaturesSection />
    <HowItWorksSection />
    <EcosystemSection />
    <CredentialShowcase />
    <Footer />
  </div>
);

export default Index;

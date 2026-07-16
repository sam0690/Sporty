import { Navbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFeatures, CtaBand } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingFooter } from "@/components/landing/landing-footer";
import { RedirectIfAuthenticated } from "@/components/auth/RedirectIfAuthenticated";

export default function HomePage() {
  return (
    <div className="landing-shell min-h-screen bg-background text-fg-1">
      <RedirectIfAuthenticated />
      <Navbar />
      <main>
        <LandingHero />
        <LandingFeatures />
        <HowItWorks />
        <CtaBand />
        <LandingFooter />
      </main>
    </div>
  );
}

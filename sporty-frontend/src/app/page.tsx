import { Navbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/landing-hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingFooter } from "@/components/landing/landing-footer";
import { RedirectIfAuthenticated } from "@/components/auth/RedirectIfAuthenticated";

export default function HomePage() {
  return (
    <div className="landing-shell min-h-screen bg-background text-[#f0f0f0]">
      <RedirectIfAuthenticated />
      <Navbar />
      <main>
        <LandingHero />
        <HowItWorks />
        <LandingFooter />
      </main>
    </div>
  );
}

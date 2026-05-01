import { Navbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/landing-hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function HomePage() {
  return (
    <div className="landing-shell min-h-screen bg-[#F4F4F9]">
      <Navbar />
      <main>
        <LandingHero />
        <HowItWorks />
        <LandingFooter />
      </main>
    </div>
  );
}

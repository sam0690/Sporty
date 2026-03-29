import { LandingHero } from "@/components/landing/landing-hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function PublicHome() {
  return (
    <>
      <LandingHero />
      <HowItWorks />
      <LandingFooter />
    </>
  );
}

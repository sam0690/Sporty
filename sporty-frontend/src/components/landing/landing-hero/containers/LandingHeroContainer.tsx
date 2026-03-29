import { LeftContent } from "@/components/landing/landing-hero/components/LeftContent";
import { RightContent } from "@/components/landing/landing-hero/components/RightContent";
import {
  LANDING_HERO_CONTENT,
  LANDING_HERO_VISUAL,
} from "@/components/landing/landing-hero/constants/landingHeroData";

export function LandingHeroContainer() {
  return (
    <section className="bg-surface-100" aria-labelledby="landing-hero-title">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8 lg:py-16">
        <div className="grid items-center gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10">
          <div>
            <LeftContent content={LANDING_HERO_CONTENT} />
          </div>
          <div>
            <RightContent visual={LANDING_HERO_VISUAL} />
          </div>
        </div>
      </div>
    </section>
  );
}

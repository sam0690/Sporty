import { LeftContent } from "@/components/landing/landing-hero/components/LeftContent";
import { RightContent } from "@/components/landing/landing-hero/components/RightContent";
import {
  LANDING_HERO_CONTENT,
  LANDING_HERO_VISUAL,
} from "@/components/landing/landing-hero/constants/landingHeroData";

export function LandingHeroContainer() {
  return (
    <section className="bg-black" aria-labelledby="landing-hero-title" id="features">
      <div className="mx-auto w-full max-w-7xl px-4 pb-14 pt-12 sm:px-6 md:pb-16 md:pt-16 lg:px-8 lg:pb-20 lg:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
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

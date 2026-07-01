import { LeftContent } from "@/components/landing/landing-hero/components/LeftContent";
import { RightContent } from "@/components/landing/landing-hero/components/RightContent";
import {
  LANDING_HERO_CONTENT,
  LANDING_HERO_VISUAL,
} from "@/components/landing/landing-hero/constants/landingHeroData";

export function LandingHeroContainer() {
  return (
    <section
      className="relative overflow-hidden bg-background"
      aria-labelledby="landing-hero-title"
      id="features"
    >
      {/* ambient broadcast wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 12% 0%, rgba(220,38,38,0.06), transparent 55%), radial-gradient(55% 55% at 100% 25%, rgba(37,99,235,0.05), transparent 55%)",
        }}
      />
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative mx-auto w-full max-w-7xl px-4 pb-14 pt-12 sm:px-6 md:pb-16 md:pt-16 lg:px-8 lg:pb-20 lg:pt-20">
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

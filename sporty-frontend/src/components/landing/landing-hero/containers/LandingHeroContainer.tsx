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
      {/* ambient broadcast glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 15% 0%, rgba(232,251,37,0.08), transparent 55%), radial-gradient(60% 60% at 100% 30%, rgba(0,212,255,0.07), transparent 55%)",
        }}
      />
      <div className="auth-dot-pattern pointer-events-none absolute inset-0 opacity-[0.15]" />

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

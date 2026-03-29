import { FooterBottomBar } from "@/components/landing/landing-footer/components/FooterBottomBar";
import { FooterCta } from "@/components/landing/landing-footer/components/FooterCta";
import {
  LANDING_FOOTER_BOTTOM,
  LANDING_FOOTER_CTA,
} from "@/components/landing/landing-footer/constants/landingFooterData";

export function LandingFooterContainer() {
  return (
    <footer className="bg-surface-100" aria-labelledby="landing-footer-title">
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pb-20 lg:pt-24">
        <FooterCta content={LANDING_FOOTER_CTA} />
      </div>
      <FooterBottomBar content={LANDING_FOOTER_BOTTOM} />
    </footer>
  );
}

import type {
  FooterBottomContent,
  FooterCtaContent,
} from "@/components/landing/landing-footer/types";

export const LANDING_FOOTER_CTA: FooterCtaContent = {
  title: "Ready to Dominate?",
  subtitle:
    "Join thousands of managers who have streamlined their fantasy experience. Start your winning journey today.",
  inputPlaceholder: "Enter your email",
  buttonLabel: "Get Early Access",
  helperText: "No credit card required • Instant account activation",
};

export const LANDING_FOOTER_BOTTOM: FooterBottomContent = {
  brandLabel: "MultiSport",
  links: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Support", href: "/support" },
    { label: "Twitter", href: "https://twitter.com" },
  ],
  copyright: "© 2024 MultiSport Fantasy Platform. All rights reserved.",
};

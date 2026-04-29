import type {
  LandingHeroContent,
  LandingHeroVisual,
} from "@/components/landing/landing-hero/types";

export const LANDING_HERO_CONTENT: LandingHeroContent = {
  badge: "NEW SEASON IS LIVE",
  title: "Build Your Ultimate\nFantasy Team",
  description:
    "Draft, manage, and compete across sports with a clean experience designed for weekly wins.",
  ctas: [
    {
      label: "Get Started",
      href: "/register",
      variant: "primary",
    },
    {
      label: "Learn More",
      href: "/#how-it-works",
      variant: "outline",
    },
  ],
  stat: {
    avatars: ["AL", "JO", "MK"],
    text: "Joined by 50k+ active players",
  },
};

export const LANDING_HERO_VISUAL: LandingHeroVisual = {
  imageAlt: "Atmospheric wide-angle sports stadium",
  imageSrc: "/images/landing/hero-stadium.jpg",
  nextMatchLabel: "Matchday arrives in 02:16:22",
  progressPercent: 68,
};

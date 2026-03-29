import type {
  LandingHeroContent,
  LandingHeroVisual,
} from "@/components/landing/landing-hero/types";

export const LANDING_HERO_CONTENT: LandingHeroContent = {
  badge: "NEW SEASON 2024 IS LIVE",
  title: "All Your\nLeagues, One\nUnified Arena.",
  description:
    "The professional choice for multi-sport enthusiasts. Manage Football, Basketball, and Cricket rosters effortlessly with advanced real-time data integration.",
  ctas: [
    {
      label: "Build Your Team",
      href: "/signUp",
      variant: "primary",
    },
    {
      label: "View Demo",
      href: "/demo",
      variant: "outline",
    },
  ],
  stat: {
    avatars: ["AL", "JO", "MK"],
    text: "Joined by 50k+ active players",
  },
};

export const LANDING_HERO_VISUAL: LandingHeroVisual = {
  imageAlt: "Sport stadium overview",
  imageSrc: "/images/landing/hero-stadium.svg",
  nextMatchLabel: "Next Match: Premier League Finals",
  progressPercent: 68,
};

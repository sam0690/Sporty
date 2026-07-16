import type {
  LandingHeroContent,
  LandingHeroVisual,
} from "@/components/landing/landing-hero/types";

export const LANDING_HERO_CONTENT: LandingHeroContent = {
  badge: "NEW SEASON IS LIVE",
  title: "One Squad.\nEvery Sport.",
  description:
    "Draft footballers, ballers, and batters into a single fantasy team. Set your lineup, watch the points land live, and settle it every matchday.",
  ctas: [
    {
      label: "Start a League",
      href: "/register",
      variant: "primary",
    },
    {
      label: "How it Works",
      href: "/#how-it-works",
      variant: "outline",
    },
  ],
};

export const LANDING_HERO_VISUAL: LandingHeroVisual = {
  nextMatchLabel: "Matchday arrives in 02:16:22",
  progressPercent: 68,
};

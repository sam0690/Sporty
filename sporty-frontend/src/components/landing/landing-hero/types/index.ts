export type HeroCta = {
  label: string;
  href: string;
  variant: "primary" | "outline";
};

export type LandingHeroContent = {
  badge: string;
  title: string;
  description: string;
  ctas: HeroCta[];
};

export type LandingHeroVisual = {
  nextMatchLabel: string;
  progressPercent: number;
};

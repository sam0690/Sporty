export type HeroCta = {
  label: string;
  href: string;
  variant: "primary" | "outline";
};

export type HeroStat = {
  avatars: string[];
  text: string;
};

export type LandingHeroContent = {
  badge: string;
  title: string;
  description: string;
  ctas: HeroCta[];
  stat: HeroStat;
};

export type LandingHeroVisual = {
  imageAlt: string;
  imageSrc: string;
  nextMatchLabel: string;
  progressPercent: number;
};

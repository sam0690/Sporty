export type HowItWorksIcon = "sport" | "squad" | "trophy";

export type HowItWorksStep = {
  title: string;
  description: string;
  bullets: string[];
  icon: HowItWorksIcon;
};

export type HowItWorksContent = {
  heading: string;
  subheading: string;
  steps: HowItWorksStep[];
};

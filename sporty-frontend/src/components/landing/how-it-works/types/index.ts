export type HowItWorksStep = {
  title: string;
  description: string;
  meta: string[];
};

export type HowItWorksContent = {
  heading: string;
  subheading: string;
  steps: HowItWorksStep[];
};

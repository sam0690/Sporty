import type { HowItWorksContent } from "@/components/landing/how-it-works/types";

export const HOW_IT_WORKS_CONTENT: HowItWorksContent = {
  heading: "How it Works",
  subheading:
    "Create your account, join a league, and compete for the top spot every matchday.",
  steps: [
    {
      title: "Create Your Account",
      description:
        "Sign up in minutes and set your manager profile to start playing.",
      bullets: [
        "Fast onboarding",
        "Secure authentication",
        "Personalized dashboard",
      ],
      icon: "sport",
    },
    {
      title: "Join or Create Leagues",
      description:
        "Play public competitions or invite friends to your private league.",
      bullets: [
        "Football, basketball, cricket",
        "Private invite codes",
        "Commissioner controls",
      ],
      icon: "squad",
    },
    {
      title: "Compete and Win",
      description:
        "Set lineups, make transfers, and climb weekly leaderboards.",
      bullets: [
        "Live points",
        "Head-to-head matchups",
        "League rankings",
      ],
      icon: "trophy",
    },
  ],
};

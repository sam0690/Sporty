import type { HowItWorksContent } from "@/components/landing/how-it-works/types";

export const HOW_IT_WORKS_CONTENT: HowItWorksContent = {
  heading: "How it Works",
  subheading:
    "Create your account, join a league, and compete for the top spot every matchday.",
  steps: [
    {
      title: "Create Your Account",
      description:
        "Sign up in minutes, set your manager profile, and land on your own dashboard.",
      meta: ["Fast onboarding", "Google sign-in"],
    },
    {
      title: "Join or Create Leagues",
      description:
        "Play public competitions or invite friends with a private code — single-sport or mixed.",
      meta: ["Football · Basketball · Cricket", "Commissioner controls"],
    },
    {
      title: "Compete and Win",
      description:
        "Set lineups, work the transfer market, and climb the table every gameweek.",
      meta: ["Live points", "Head-to-head", "Rankings"],
    },
  ],
};

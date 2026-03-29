import type { HowItWorksContent } from "@/components/landing/how-it-works/types";

export const HOW_IT_WORKS_CONTENT: HowItWorksContent = {
  heading: "How it Works",
  subheading:
    "Experience a professional-grade interface designed for speed and clarity. Managing multiple sports has never been this intuitive.",
  steps: [
    {
      title: "Pick Your Sport",
      description:
        "Choose between Football, Basketball, or Cricket leagues instantly with our unified selection tool.",
      bullets: [
        "Premier League & Champions League",
        "NBA & International Basketball",
        "IPL, Test & ODI Series",
      ],
      icon: "sport",
    },
    {
      title: "Build Your Squad",
      description:
        "Use advanced data analytics to draft your winning team across all platforms with real-time stats.",
      bullets: [
        "Advanced Player Metrics",
        "Injury Reports & Lineups",
        "Budget Management Tools",
      ],
      icon: "squad",
    },
    {
      title: "Win Together",
      description:
        "Compete in global contests, join private leagues, and track your rankings in real-time.",
      bullets: [
        "Live Point Tracking",
        "Instant Prize Payouts",
        "Social Community Hub",
      ],
      icon: "trophy",
    },
  ],
};

import type { Metadata } from "next";

import { PublicMatchesView } from "@/components/public-matches/PublicMatchesView";

export const metadata: Metadata = {
  title: "Fixtures & Results | Sporty",
  description:
    "Live scores, upcoming kickoffs and recent results across football, basketball and cricket. Free to browse — no account needed.",
};

export default function FixturesPage() {
  return <PublicMatchesView />;
}

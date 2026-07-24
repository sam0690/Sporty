import type { Metadata } from "next";

import { FixturesView } from "@/features/fixtures/FixturesView";

export const metadata: Metadata = {
  title: "Fixtures & Results | Sporty",
  description:
    "Live scores, upcoming kickoffs and recent results across football, basketball and cricket. Free to browse — no account needed.",
};

export default function FixturesPage() {
  return <FixturesView />;
}

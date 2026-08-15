import type { Metadata } from "next";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

import { FixturesView } from "@/features/fixtures/FixturesView";
import { fixturesKey } from "@/hooks/fixtures/useFixtures";
import { publicFetch } from "@/services/server/publicFetch";
import type { TFixtureListResponse } from "@/types/fixture";

export const metadata: Metadata = {
  title: "Fixtures & Results | Sporty",
  description:
    "Live scores, upcoming kickoffs and recent results across football, basketball and cricket. Free to browse — no account needed.",
};

function serverDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function FixturesPage() {
  const queryClient = new QueryClient();

  // The day the client asks for is its LOCAL date, and this is the server's
  // UTC date. They agree for most visitors most of the day; when they don't,
  // the client simply fetches on mount as it always did — this prefetch is
  // never load-bearing. The server fetch itself is revalidate-cached and
  // shared across all visitors, so the miss costs one backend query a minute,
  // not one per user.
  const filters = { sport_name: undefined, date: serverDateKey() };
  const data = await publicFetch<TFixtureListResponse>("/fixtures", {
    date: filters.date,
  });

  if (data) {
    queryClient.setQueryData(fixturesKey(filters), data);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FixturesView />
    </HydrationBoundary>
  );
}

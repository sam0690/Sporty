"use client";

import { useMemo, type ReactNode } from "react";

import { useMatchStore } from "@/store/matchStore";
import type { MatchRatings } from "@/types/events";
import { EventFeed } from "./EventFeed";
import { LineupCard } from "./LineupCard";
import { LiveLeaderboard } from "./LiveLeaderboard";
import { MatchLineupPitch } from "./MatchLineupPitch";
import { RatingsCard } from "./RatingsCard";
import { PredictCard } from "./PredictCard";
import { TeamStatsCard } from "./TeamStatsCard";
import { PanelEmpty } from "./Panel";
import { ChartIcon, ListIcon, ShieldIcon, TrophyIcon } from "./icons";

export type FixtureTab = "summary" | "lineups" | "stats" | "predict";

const TABS: { id: FixtureTab; label: string; icon: ReactNode }[] = [
  { id: "summary", label: "Summary", icon: <ListIcon className="size-3.5" /> },
  { id: "lineups", label: "Lineups", icon: <ShieldIcon className="size-3.5" /> },
  { id: "stats", label: "Stats", icon: <ChartIcon className="size-3.5" /> },
  { id: "predict", label: "Predict", icon: <TrophyIcon className="size-3.5" /> },
];

/** The default tab when the user hasn't picked one: lead with the pitch when a
 *  lineup exists (it's the richest pre-match view), otherwise the timeline. */
export function useDefaultTab(): FixtureTab {
  const startingLineups = useMatchStore((s) => s.startingLineups);
  const hasLineup =
    startingLineups.home.length > 0 || startingLineups.away.length > 0;
  return hasLineup ? "lineups" : "summary";
}

export function FixtureTabBar({
  active,
  onChange,
}: {
  active: FixtureTab;
  onChange: (tab: FixtureTab) => void;
}) {
  // Predictor is football-only (MVP) — hide the tab on other sports.
  const sport = useMatchStore((s) => s.sport);
  const tabs = TABS.filter(
    (t) => t.id !== "predict" || sport == null || sport === "football",
  );
  return (
    <div
      role="tablist"
      aria-label="Match sections"
      className="flex gap-1 overflow-x-auto px-1"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative flex shrink-0 items-center gap-2 px-4 py-3 font-sans text-xs font-700 uppercase tracking-[1px] transition-colors duration-150 ${
              isActive ? "text-accent" : "text-fg-3 hover:text-fg-1"
            }`}
          >
            <span className={isActive ? "text-accent" : "text-fg-3"}>
              {tab.icon}
            </span>
            {tab.label}
            <span
              aria-hidden
              className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
                isActive
                  ? "scale-x-100 bg-accent opacity-100"
                  : "scale-x-0 bg-transparent opacity-0"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function Summary() {
  return (
    <div className="mx-auto max-w-2xl">
      <EventFeed />
    </div>
  );
}

function Lineups() {
  const lineup = useMatchStore((s) => s.lineup);
  const hasLineupChanges = Object.keys(lineup).length > 0;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <MatchLineupPitch />
      {hasLineupChanges && <LineupCard />}
    </div>
  );
}

function Stats({ ratings }: { ratings: MatchRatings | null }) {
  const playerPoints = useMatchStore((s) => s.playerPoints);
  const events = useMatchStore((s) => s.events);
  const teamStats = useMatchStore((s) => s.teamStats);
  const hasRatings = ratings != null && ratings.ratings.length > 0;
  const hasBoard = Object.keys(playerPoints).length > 0 || events.length > 0;

  if (!hasRatings && !hasBoard && !teamStats) {
    return (
      <div className="card-surface p-5">
        <PanelEmpty
          icon={<ChartIcon className="size-5" />}
          title="No stats yet"
          hint="Ratings and standout performers appear once the match is underway."
        />
      </div>
    );
  }

  // Match stats leads at full width: five groups of bars is far too tall to sit
  // in a half column beside Ratings, and the bars need the width to be read.
  return (
    <div className="space-y-6">
      <TeamStatsCard />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <RatingsCard ratings={ratings} />
        <LiveLeaderboard />
      </div>
    </div>
  );
}

export function FixtureTabPanels({
  active,
  ratings,
  matchId,
}: {
  active: FixtureTab;
  ratings: MatchRatings | null;
  matchId: string;
}) {
  // key on the active tab so a switch crossfades the incoming panel in.
  const content = useMemo(() => {
    switch (active) {
      case "lineups":
        return <Lineups />;
      case "stats":
        return <Stats ratings={ratings} />;
      case "predict":
        return <PredictCard matchId={matchId} />;
      default:
        return <Summary />;
    }
  }, [active, ratings, matchId]);

  return (
    <div
      key={active}
      role="tabpanel"
      className="animate-fade-soft motion-reduce:animate-none"
    >
      {content}
    </div>
  );
}

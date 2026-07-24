"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import { Select } from "@/components/ui/Select";
import { CompetitionLogo } from "@/components/ui/CompetitionLogo";
import { competitionMeta } from "@/lib/footballCompetitions";
import {
  useCompetitionMatches,
  useCompetitionScorers,
  useCompetitionStandings,
  useCompetitionsIndex,
} from "@/hooks/competitions/useCompetitions";
import { StandingsTable } from "./components/StandingsTable";
import { ScorersTable } from "./components/ScorersTable";
import { CompetitionMatches } from "./components/CompetitionMatches";
import { KnockoutBracket, hasKnockout } from "./components/KnockoutBracket";

type Tab = "standings" | "bracket" | "fixtures" | "results" | "stats";
const BASE_TABS: { key: Tab; label: string }[] = [
  { key: "standings", label: "Standings" },
  { key: "fixtures", label: "Fixtures" },
  { key: "results", label: "Results" },
  { key: "stats", label: "Stats" },
];

// Season start year -> "2026/27"
function seasonLabel(year: number) {
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

function TabPanel({ loading, error, empty, children }: {
  loading: boolean;
  error: boolean;
  empty?: boolean;
  children: React.ReactNode;
}) {
  if (loading)
    return <div className="skeleton h-80 rounded-[3px] border border-white/6" />;
  if (error)
    return (
      <div className="card-surface px-6 py-12 text-center text-sm text-fg-2">
        Couldn&apos;t load this data. Try again shortly.
      </div>
    );
  if (empty)
    return (
      <div className="card-surface px-6 py-12 text-center text-sm text-fg-2">
        No data available for this season yet.
      </div>
    );
  return <>{children}</>;
}

export function CompetitionView({ tag }: { tag: string }) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const { data: index } = useCompetitionsIndex();
  const [season, setSeason] = useState<number | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("standings");

  const meta = competitionMeta(tag);
  const competitions = index?.competitions ?? [];

  const standings = useCompetitionStandings(tag, season);
  const scorers = useCompetitionScorers(tag, season);
  const matches = useCompetitionMatches(tag, season);

  const table = standings.data?.data.standings?.[0]?.table ?? [];
  const scorerRows = scorers.data?.data.scorers ?? [];
  const matchRows = matches.data?.data.matches ?? [];

  // Before a season kicks off, football-data.org returns last season's final
  // table as a placeholder (tagged with the upcoming season). Detect that so
  // we can tell the user the table isn't the labelled season's yet.
  const stSeason = standings.data?.data.season;
  const seasonNotStarted = stSeason?.startDate
    ? new Date(stSeason.startDate) > new Date()
    : (stSeason?.currentMatchday ?? 99) <= 1;
  const showingLastSeason =
    seasonNotStarted && table.length > 0 && (table[0]?.playedGames ?? 0) > 0;

  // The season actually served — a competition resolves its own current (CL's
  // calendar lags the domestic leagues, so it differs from index.current_season).
  const activeSeason =
    season ?? standings.data?.season ?? matches.data?.season ?? index?.current_season;

  // Bracket tab only for competitions that have a knockout stage (CL does).
  const showBracket = hasKnockout(matchRows);
  const tabs = useMemo(
    () =>
      showBracket
        ? [
            BASE_TABS[0],
            { key: "bracket" as Tab, label: "Bracket" },
            ...BASE_TABS.slice(1),
          ]
        : BASE_TABS,
    [showBracket],
  );
  // Keep the active tab valid when switching to a competition without a bracket.
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "standings";

  const seasonOptions = useMemo(
    () =>
      (index?.seasons ?? []).map((y) => ({
        value: String(y),
        label: seasonLabel(y),
      })),
    [index?.seasons],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header: competition switcher + season */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="section-label mb-2">Competitions</p>
          <div
            role="tablist"
            aria-label="Competition"
            className="flex flex-wrap gap-2"
          >
            {competitions.map((c) => {
              const cm = competitionMeta(c.tag);
              const active = c.tag === tag;
              return (
                <button
                  key={c.tag}
                  type="button"
                  onClick={() => router.push(`/competitions/${c.tag.toLowerCase()}`)}
                  className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-700 transition-colors ${
                    active
                      ? "border-accent/40 bg-accent/8 text-accent"
                      : "border-white/8 bg-surface-2 text-fg-2 hover:border-white/18"
                  }`}
                >
                  <CompetitionLogo tag={c.tag} className="size-4" />
                  {cm?.label ?? c.name}
                </button>
              );
            })}
          </div>
        </div>
        {seasonOptions.length > 0 && (
          <Select
            aria-label="Season"
            value={String(activeSeason ?? "")}
            onChange={(v) => setSeason(Number(v))}
            options={seasonOptions}
            className="sm:w-36"
          />
        )}
      </div>

      <h1 className="mb-5 flex items-center gap-2.5 text-2xl font-800 tracking-tight text-fg-1">
        <CompetitionLogo tag={tag} className="size-8" />
        {meta?.label ?? tag}
        {activeSeason && (
          <span className="text-base font-500 text-fg-3">
            {seasonLabel(activeSeason)}
          </span>
        )}
      </h1>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-white/8" role="tablist">
        {tabs.map((t) => {
          const active = t.key === activeTab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-2.5 text-sm font-700 transition-colors ${
                active ? "text-accent" : "text-fg-3 hover:text-fg-1"
              }`}
            >
              {t.label}
              {active && (
                <motion.span
                  layoutId="competition-tab-underline"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 500, damping: 34 }
                  }
                />
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "standings" && (
        <TabPanel
          loading={standings.isLoading}
          error={standings.isError}
          empty={table.length === 0}
        >
          {showingLastSeason ? (
            <div className="card-surface px-6 py-16 text-center">
              <CompetitionLogo tag={tag} className="mx-auto size-12" />
              <p className="mt-4 text-sm font-700 text-fg-1">
                {activeSeason ? seasonLabel(activeSeason) : "This season"} hasn&apos;t
                kicked off yet
              </p>
              <p className="mt-1.5 text-xs text-fg-3">
                The table will appear after the first matchday. Pick an earlier season
                above to see final standings.
              </p>
            </div>
          ) : (
            <StandingsTable table={table} tag={tag} />
          )}
        </TabPanel>
      )}
      {activeTab === "bracket" && (
        <TabPanel loading={matches.isLoading} error={matches.isError}>
          <KnockoutBracket matches={matchRows} />
        </TabPanel>
      )}
      {activeTab === "fixtures" && (
        <TabPanel loading={matches.isLoading} error={matches.isError}>
          <CompetitionMatches matches={matchRows} mode="fixtures" />
        </TabPanel>
      )}
      {activeTab === "results" && (
        <TabPanel loading={matches.isLoading} error={matches.isError}>
          <CompetitionMatches matches={matchRows} mode="results" />
        </TabPanel>
      )}
      {activeTab === "stats" && (
        <TabPanel
          loading={scorers.isLoading}
          error={scorers.isError}
          empty={scorerRows.length === 0}
        >
          <ScorersTable scorers={scorerRows} tag={tag} />
        </TabPanel>
      )}
    </div>
  );
}

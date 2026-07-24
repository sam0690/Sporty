"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import { Select } from "@/components/ui/Select";
import { sportGlyph } from "@/components/landing/sport-icons";
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
  // Competition pages are all football — one glyph, icon-based (no emoji flags).
  const fbGlyph = sportGlyph("football");
  const GlyphIcon = fbGlyph.Icon;

  const standings = useCompetitionStandings(tag, season);
  const scorers = useCompetitionScorers(tag, season);
  const matches = useCompetitionMatches(tag, season);

  const table = standings.data?.data.standings?.[0]?.table ?? [];
  const scorerRows = scorers.data?.data.scorers ?? [];
  const matchRows = matches.data?.data.matches ?? [];

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
                  <GlyphIcon className="size-3.5" aria-hidden="true" />
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
        <span
          className="grid size-7 shrink-0 place-items-center rounded-[5px]"
          style={{ color: fbGlyph.color, background: `${fbGlyph.color}1a` }}
          aria-hidden="true"
        >
          <GlyphIcon className="size-4" />
        </span>
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
          <StandingsTable table={table} />
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
          <p className="section-label mb-3">Top Scorers</p>
          <ScorersTable scorers={scorerRows} />
        </TabPanel>
      )}
    </div>
  );
}

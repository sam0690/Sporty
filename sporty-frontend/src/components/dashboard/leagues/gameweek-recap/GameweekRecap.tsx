"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { LineupViewToggle } from "@/components/dashboard/leagues/league-lineup/components/LineupViewToggle";
import { RecapPitchView } from "@/components/dashboard/leagues/gameweek-recap/components/RecapPitchView";
import { PlayerAvatar, TeamLogo } from "@/components/ui";
import { useGameweekRecap } from "@/hooks/leagues/useLeagues";
import type {
  TGameweekPlayerRecap,
  TGameweekPlayerStatus,
} from "@/types/league";

const SPORT_ACCENT: Record<string, string> = {
  football: "#00ff88",
  soccer: "#00ff88",
  basketball: "#ff6b35",
  cricket: "#00d4ff",
};

function sportAccent(sport?: string): string {
  return SPORT_ACCENT[(sport ?? "").toLowerCase()] ?? "#e2c368";
}

function fmt(points: string | number): string {
  const n = Number(points);
  if (Number.isNaN(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const STATUS_META: Record<
  TGameweekPlayerStatus,
  { label: string; color: string }
> = {
  played: { label: "Played", color: "#a0a0aa" },
  did_not_play: { label: "Did not play", color: "#ff3b5c" },
  not_yet_played: { label: "Not yet played", color: "#a0a0aa" },
  subbed_in: { label: "Subbed in", color: "#00e07f" },
  subbed_out: { label: "Subbed out", color: "#ff3b5c" },
  benched: { label: "Bench", color: "#71717d" },
};

function ArmbandBadge({ letter, color }: { letter: string; color: string }) {
  return (
    <span
      className="grid size-4 shrink-0 place-items-center rounded-full font-sans text-[9px] font-700"
      style={{ color, background: `${color}1f`, border: `1px solid ${color}59` }}
    >
      {letter}
    </span>
  );
}

function SubArrow({ dir }: { dir: "in" | "out" }) {
  const color = dir === "in" ? "#00e07f" : "#ff3b5c";
  const d = dir === "in" ? "M12 19V5M12 5l-5 5M12 5l5 5" : "M12 5v14M12 19l-5-5M12 19l5-5";
  return (
    <span
      className="grid size-4 shrink-0 place-items-center rounded-full"
      style={{ color, background: `${color}22` }}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={d} />
      </svg>
    </span>
  );
}

function PlayerRow({ p }: { p: TGameweekPlayerRecap }) {
  const accent = sportAccent(p.player.sport?.name);
  const status = STATUS_META[p.status];
  const contributed = Number(p.contributed_points);

  return (
    <li className="flex items-center gap-3 rounded-[3px] px-2.5 py-2.5 transition-colors hover:bg-white/3">
      <PlayerAvatar name={p.player.name} photoUrl={p.player.photo_url} size="sm" className="shrink-0" />
      <span
        className="grid h-7 min-w-9 shrink-0 place-items-center rounded-[3px] px-1 font-sans text-[10px] font-700 uppercase tracking-[0.5px]"
        style={{ color: accent, background: `${accent}17`, border: `1px solid ${accent}33` }}
      >
        {p.player.position}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
            {p.player.name}
          </span>
          {p.is_captain && <ArmbandBadge letter="C" color="#e2c368" />}
          {p.is_vice_captain && <ArmbandBadge letter="V" color="#a0a0aa" />}
          {p.status === "subbed_in" && <SubArrow dir="in" />}
          {p.status === "subbed_out" && <SubArrow dir="out" />}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-fg-3">
          {p.player.real_team ? (
            <span className="flex items-center gap-1.5 truncate">
              <TeamLogo teamName={p.player.real_team} logoUrl={p.player.real_team_logo_url} size="sm" />
              {p.player.real_team}
            </span>
          ) : null}
          <span className="text-white/20">·</span>
          <span style={{ color: status.color }}>{status.label}</span>
          <span className="text-white/20">·</span>
          <span>{p.minutes_played}&apos;</span>
        </div>
      </div>

      {p.captain_bonus && Number(p.captain_bonus) > 0 ? (
        <span className="hidden shrink-0 rounded-[3px] bg-accent/12 px-2 py-0.5 font-sans text-[10px] font-700 uppercase tracking-[1px] text-accent sm:inline">
          +{fmt(p.captain_bonus)} bonus
        </span>
      ) : null}

      <span
        className={`shrink-0 font-display text-xl leading-none tracking-[-0.02em] tabular-nums ${
          p.counted ? "text-accent" : "text-fg-3"
        }`}
      >
        {contributed > 0 ? "+" : ""}
        {fmt(p.contributed_points)}
      </span>
    </li>
  );
}

function Section({
  title,
  players,
  count,
}: {
  title: string;
  players: TGameweekPlayerRecap[];
  count: number;
}) {
  if (players.length === 0) return null;
  return (
    <section className="overflow-hidden card-surface">
      <header className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <span className="section-label">{title}</span>
        <span className="rounded-[3px] bg-white/6 px-2 py-0.5 font-sans text-[11px] font-700 tabular-nums text-fg-2">
          {count}
        </span>
      </header>
      <ul className="p-2">
        {players.map((p) => (
          <PlayerRow key={p.player.id} p={p} />
        ))}
      </ul>
    </section>
  );
}

export function GameweekRecap() {
  const params = useParams();
  const leagueId = String(params?.id ?? "");
  // null = "latest scored gameweek" (server default).
  const [gw, setGw] = useState<number | null>(null);
  const [view, setView] = useState<"list" | "pitch">("pitch");

  const { data, isLoading, isError } = useGameweekRecap(
    leagueId,
    gw ?? undefined,
  );
  // Remember the newest scored gameweek (loaded when gw === null) so the stepper
  // knows its upper bound. Converges via the render-time setState pattern.
  const [maxGw, setMaxGw] = useState<number | null>(null);
  const currentGw = data?.gameweek_number ?? null;
  if (gw === null && currentGw !== null && currentGw !== maxGw) {
    setMaxGw(currentGw);
  }

  const canPrev = currentGw != null && currentGw > 1;
  const canNext = currentGw != null && maxGw != null && currentGw < maxGw;

  const starters = data?.players.filter((p) => p.is_starter) ?? [];
  const bench = data?.players.filter((p) => !p.is_starter) ?? [];

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/8 pb-6">
        <div>
          <p className="section-label">Gameweek Recap</p>
          <h1 className="mt-2 font-display text-5xl tracking-[-0.02em] text-fg-1 sm:text-6xl">
            {data?.team_name ?? "My Team"}
          </h1>
          <p className="mt-1 text-sm text-fg-3">
            How each of your players scored this gameweek.
          </p>
        </div>

        {/* Gameweek stepper */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => currentGw && setGw(currentGw - 1)}
            className="grid size-11 place-items-center rounded-[3px] border border-white/12 text-fg-2 transition-colors hover:border-white/25 hover:text-fg-1 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Previous gameweek"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-28 rounded-[3px] border border-accent/30 bg-accent/8 px-3 py-2 text-center font-sans text-xs font-700 uppercase tracking-[1.5px] text-accent">
            {currentGw != null ? `Gameweek ${currentGw}` : "—"}
          </span>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => currentGw && setGw(currentGw + 1)}
            className="grid size-11 place-items-center rounded-[3px] border border-white/12 text-fg-2 transition-colors hover:border-white/25 hover:text-fg-1 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next gameweek"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {isLoading && (
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-[3px] bg-surface-1" />
          <div className="h-64 animate-pulse rounded-[3px] bg-surface-1" />
        </div>
      )}

      {isError && (
        <p className="rounded-[3px] border border-danger/25 bg-danger/7 px-4 py-3 text-sm text-danger-soft">
          Couldn&apos;t load this gameweek. It may not be scored yet.
        </p>
      )}

      {data && !isLoading && (
        <>
          {/* Summary scoreboard */}
          <section className="overflow-hidden card-surface p-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="section-label">Total Points</p>
                <p className="mt-1 font-display text-7xl leading-none tracking-[-0.02em] text-accent">
                  {fmt(data.total_points)}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {data.rank_in_league != null && (
                  <Stat label="League Rank" value={`#${data.rank_in_league}`} />
                )}
                <Stat label="Base" value={fmt(data.base_points)} />
                <Stat
                  label="Captain Bonus"
                  value={`+${fmt(data.captain_vice_bonus)}`}
                  accent
                />
              </div>
            </div>
          </section>

          {data.players.length > 0 && (
            <div className="flex justify-end">
              <LineupViewToggle value={view} onChange={setView} />
            </div>
          )}

          {view === "pitch" ? (
            data.players.length > 0 && <RecapPitchView players={data.players} />
          ) : (
            <>
              <Section title="Starting XI" players={starters} count={starters.length} />
              <Section title="Bench" players={bench} count={bench.length} />
            </>
          )}

          {data.players.length === 0 && (
            <div className="card-surface p-10 text-center">
              <p className="font-sans text-base font-700 uppercase tracking-[1px] text-fg-2">
                No lineup for this gameweek
              </p>
              <p className="mt-1 text-sm text-fg-3">
                You didn&apos;t have a team set for gameweek {currentGw}.
              </p>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[3px] border border-white/8 bg-surface-2 px-4 py-2.5 text-center">
      <p className="section-label">{label}</p>
      <p
        className={`mt-1 font-display text-2xl leading-none tracking-[-0.02em] tabular-nums ${
          accent ? "text-accent" : "text-fg-1"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

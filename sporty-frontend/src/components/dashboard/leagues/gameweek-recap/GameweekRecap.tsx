"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { PlayerAvatar, TeamLogo } from "@/components/ui";
import { useGameweekRecap, useLeague } from "@/hooks/leagues/useLeagues";
import { useMe } from "@/hooks/auth/useMe";
import type {
  TGameweekPlayerRecap,
  TGameweekPlayerStatus,
} from "@/types/league";

const SPORT_ACCENT: Record<string, string> = {
  football: "#00ff88",
  soccer: "#00ff88",
  basketball: "#ff6b00",
  cricket: "#00d4ff",
};

function sportAccent(sport?: string): string {
  return SPORT_ACCENT[(sport ?? "").toLowerCase()] ?? "#e8fb25";
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
  played: { label: "Played", color: "#9a9aa5" },
  did_not_play: { label: "Did not play", color: "#ff3b5c" },
  not_yet_played: { label: "Not yet played", color: "#9a9aa5" },
  subbed_in: { label: "Subbed in", color: "#00ff88" },
  subbed_out: { label: "Subbed out", color: "#ff3b5c" },
  benched: { label: "Bench", color: "#555560" },
};

function ArmbandBadge({ letter, color }: { letter: string; color: string }) {
  return (
    <span
      className="grid size-4 shrink-0 place-items-center rounded-full font-barlow-condensed text-[9px] font-700"
      style={{ color, background: `${color}1f`, border: `1px solid ${color}59` }}
    >
      {letter}
    </span>
  );
}

function SubArrow({ dir }: { dir: "in" | "out" }) {
  const color = dir === "in" ? "#00ff88" : "#ff3b5c";
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
    <li className="flex items-center gap-3 rounded-[8px] px-2.5 py-2.5 transition-colors hover:bg-[rgba(255,255,255,0.03)]">
      <PlayerAvatar name={p.player.name} photoUrl={p.player.photo_url} size="sm" className="shrink-0" />
      <span
        className="grid h-7 min-w-9 shrink-0 place-items-center rounded-[6px] px-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[0.5px]"
        style={{ color: accent, background: `${accent}17`, border: `1px solid ${accent}33` }}
      >
        {p.player.position}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
            {p.player.name}
          </span>
          {p.is_captain && <ArmbandBadge letter="C" color="#e8fb25" />}
          {p.is_vice_captain && <ArmbandBadge letter="V" color="#9a9aa5" />}
          {p.status === "subbed_in" && <SubArrow dir="in" />}
          {p.status === "subbed_out" && <SubArrow dir="out" />}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#6a6a76]">
          {p.player.real_team ? (
            <span className="flex items-center gap-1.5 truncate">
              <TeamLogo teamName={p.player.real_team} logoUrl={p.player.real_team_logo_url} size="sm" />
              {p.player.real_team}
            </span>
          ) : null}
          <span className="text-[#33333a]">·</span>
          <span style={{ color: status.color }}>{status.label}</span>
          <span className="text-[#33333a]">·</span>
          <span>{p.minutes_played}&apos;</span>
        </div>
      </div>

      {p.captain_bonus && Number(p.captain_bonus) > 0 ? (
        <span className="hidden shrink-0 rounded-full bg-[rgba(232,251,37,0.12)] px-2 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#e8fb25] sm:inline">
          +{fmt(p.captain_bonus)} bonus
        </span>
      ) : null}

      <span
        className={`shrink-0 font-bebas text-xl leading-none tracking-[1px] tabular-nums ${
          p.counted ? "text-[#e8fb25]" : "text-[#555560]"
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
    <section className="overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-gradient-to-b from-[#14141b] to-[#0f0f14]">
      <header className="flex items-center justify-between border-b border-[rgba(255,255,255,0.07)] px-4 py-3">
        <span className="section-label">{title}</span>
        <span className="rounded-full bg-[rgba(255,255,255,0.06)] px-2 py-0.5 font-barlow-condensed text-[11px] font-700 tabular-nums text-[#9a9aa5]">
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

  const { data, isLoading, isError } = useGameweekRecap(
    leagueId,
    gw ?? undefined,
  );
  const { data: league } = useLeague(leagueId);
  const { username } = useMe();
  const isCommissioner = league?.owner?.username === username;

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
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <NavigationTabs
        activeTab="gameweek"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[rgba(255,255,255,0.08)] pb-6">
        <div>
          <p className="section-label">Gameweek Recap</p>
          <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#f0f0f0] sm:text-6xl">
            {data?.team_name ?? "My Team"}
          </h1>
          <p className="mt-1 text-sm text-[#555560]">
            How each of your players scored this gameweek.
          </p>
        </div>

        {/* Gameweek stepper */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => currentGw && setGw(currentGw - 1)}
            className="grid size-9 place-items-center rounded-[8px] border border-[rgba(255,255,255,0.12)] text-[#9a9aa5] transition-colors hover:border-[rgba(255,255,255,0.25)] hover:text-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Previous gameweek"
          >
            ‹
          </button>
          <span className="min-w-28 rounded-[8px] border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.08)] px-3 py-2 text-center font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#e8fb25]">
            {currentGw != null ? `Gameweek ${currentGw}` : "—"}
          </span>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => currentGw && setGw(currentGw + 1)}
            className="grid size-9 place-items-center rounded-[8px] border border-[rgba(255,255,255,0.12)] text-[#9a9aa5] transition-colors hover:border-[rgba(255,255,255,0.25)] hover:text-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Next gameweek"
          >
            ›
          </button>
        </div>
      </header>

      {isLoading && (
        <div className="space-y-3">
          <div className="h-28 animate-pulse rounded-[14px] bg-[#14141b]" />
          <div className="h-64 animate-pulse rounded-[12px] bg-[#14141b]" />
        </div>
      )}

      {isError && (
        <p className="rounded-[10px] border border-[rgba(255,59,92,0.25)] bg-[rgba(255,59,92,0.07)] px-4 py-3 text-sm text-[#ff8a8a]">
          Couldn&apos;t load this gameweek. It may not be scored yet.
        </p>
      )}

      {data && !isLoading && (
        <>
          {/* Summary scoreboard */}
          <section className="relative overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.09)] bg-[#0b0b10] p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,1)]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(70% 80% at 100% 0%, rgba(232,251,37,0.1), transparent 55%)",
              }}
            />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="section-label">Total Points</p>
                <p className="mt-1 font-bebas text-7xl leading-none tracking-[2px] text-[#e8fb25]">
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

          <Section title="Starting XI" players={starters} count={starters.length} />
          <Section title="Bench" players={bench} count={bench.length} />

          {data.players.length === 0 && (
            <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#0f0f14] p-10 text-center">
              <p className="font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-[#9a9aa5]">
                No lineup for this gameweek
              </p>
              <p className="mt-1 text-sm text-[#555560]">
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
    <div className="rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-2.5 text-center">
      <p className="section-label">{label}</p>
      <p
        className={`mt-1 font-bebas text-2xl leading-none tracking-[1px] tabular-nums ${
          accent ? "text-[#e8fb25]" : "text-[#f0f0f0]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

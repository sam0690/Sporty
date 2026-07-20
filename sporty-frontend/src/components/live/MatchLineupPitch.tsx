"use client";

import { PlayerAvatar } from "@/components/ui";
import { CourtRenderer } from "@/components/dashboard/shared/formation/CourtRenderer";
import { PitchRenderer } from "@/components/dashboard/shared/formation/PitchRenderer";
import { teamIdentity } from "@/lib/teamIdentity";
import { useMatchStore } from "@/store/matchStore";
import type { LineupPlayer } from "@/types/events";
import { LineupsCard } from "./LineupsCard";
import { Panel } from "./Panel";
import { ListIcon } from "./icons";
import {
  placeMatchTeam,
  type LineupSport,
  type PlacedPlayer,
  type PitchPlayer,
} from "./matchLineupLayout";

// Surname only, so the on-pitch label stays inside the chip width.
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function PitchChip({ placed, color }: { placed: PlacedPlayer; color: string }) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: `${placed.x * 100}%`, top: `${placed.y * 100}%` }}
    >
      <div
        className="h-9 w-9 overflow-hidden rounded-full border-2 bg-black/30 shadow-md sm:h-11 sm:w-11"
        style={{ borderColor: color }}
      >
        <PlayerAvatar
          name={placed.player.name}
          photoUrl={placed.player.photoUrl}
          size="sm"
          className="!h-full !w-full !rounded-full !border-0 !bg-transparent"
        />
      </div>
      <span className="max-w-16 truncate rounded bg-black/55 px-1 py-0.5 text-center font-sans text-[9px] font-700 uppercase tracking-[0.5px] text-white backdrop-blur-xs">
        {shortName(placed.player.name)}
      </span>
    </div>
  );
}

function BenchColumn({
  teamName,
  players,
  align,
}: {
  teamName: string;
  players: LineupPlayer[];
  align: "left" | "right";
}) {
  const { color } = teamIdentity(teamName);
  const isRight = align === "right";
  if (players.length === 0) {
    return null;
  }
  return (
    <div>
      <p
        className={`section-label mb-2 ${isRight ? "text-right" : ""}`}
      >
        {teamName} bench
      </p>
      <ul className="space-y-1.5">
        {players.map((p) => (
          <li
            key={p.player_id}
            className={`flex items-center gap-2 ${isRight ? "flex-row-reverse text-right" : ""}`}
          >
            <div
              className="h-7 w-7 shrink-0 overflow-hidden rounded-full border bg-black/30"
              style={{ borderColor: `${color}66` }}
            >
              <PlayerAvatar
                name={p.name ?? "Unknown"}
                photoUrl={p.photo_url}
                size="sm"
                className="!h-full !w-full !rounded-full !border-0 !bg-transparent !text-[9px]"
              />
            </div>
            <span className="truncate text-sm text-fg-2">{p.name ?? "Unknown"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeamLegend({
  teamName,
  formationLabel,
  align,
}: {
  teamName: string;
  formationLabel: string;
  align: "left" | "right";
}) {
  const { color } = teamIdentity(teamName);
  const isRight = align === "right";
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${isRight ? "flex-row-reverse text-right" : ""}`}
    >
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
          {teamName}
        </p>
        <p className="section-label mt-0.5">{formationLabel}</p>
      </div>
    </div>
  );
}

export function MatchLineupPitch() {
  const sport = useMatchStore((s) => s.sport);
  const startingLineups = useMatchStore((s) => s.startingLineups);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);

  // Football and basketball each get their own surface; other sports (cricket,
  // …) keep the text list until they have a court/pitch layout of their own.
  const normalizedSport = (sport ?? "").toLowerCase();
  const lineupSport: LineupSport | null =
    normalizedSport === "football"
      ? "football"
      : normalizedSport === "basketball"
        ? "basketball"
        : null;
  if (lineupSport === null) {
    return <LineupsCard />;
  }

  const { home, away, home_bench = [], away_bench = [] } = startingLineups;
  if (home.length === 0 && away.length === 0) {
    return null;
  }

  const homeName = homeTeam ?? "Home";
  const awayName = awayTeam ?? "Away";
  const homeColor = teamIdentity(homeName).color;
  const awayColor = teamIdentity(awayName).color;
  const homeLayout = placeMatchTeam(home, "home", lineupSport);
  const awayLayout = placeMatchTeam(away, "away", lineupSport);
  const Surface = lineupSport === "basketball" ? CourtRenderer : PitchRenderer;

  const renderChips = (placed: PlacedPlayer[], color: string) =>
    placed.map((p: PlacedPlayer & { player: PitchPlayer }) => (
      <PitchChip key={p.player.id} placed={p} color={color} />
    ));

  return (
    <Panel title="Lineups" icon={<ListIcon className="size-3.5" />}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <TeamLegend
          teamName={awayName}
          formationLabel={awayLayout.formationLabel}
          align="left"
        />
        <span className="section-label shrink-0">vs</span>
        <TeamLegend
          teamName={homeName}
          formationLabel={homeLayout.formationLabel}
          align="right"
        />
      </div>

      <Surface className="max-w-[460px]">
        {/* Halfway divider between the two facing teams. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/15"
        />
        {renderChips(awayLayout.placed, awayColor)}
        {renderChips(homeLayout.placed, homeColor)}
      </Surface>

      {(home_bench.length > 0 || away_bench.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-5">
          <BenchColumn teamName={awayName} players={away_bench} align="left" />
          <BenchColumn teamName={homeName} players={home_bench} align="right" />
        </div>
      )}
    </Panel>
  );
}

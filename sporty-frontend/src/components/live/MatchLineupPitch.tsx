"use client";

import { PlayerAvatar } from "@/components/ui";
import { MatchCourtSurface } from "./MatchCourtSurface";
import { matchIdentities } from "@/lib/teamIdentity";
import { useMatchStore } from "@/store/matchStore";
import type { LineupPlayer } from "@/types/events";
import { LineupsCard } from "./LineupsCard";
import { MatchPitchSurface } from "./MatchPitchSurface";
import { PanelEmpty } from "./Panel";
import { ShieldIcon } from "./icons";
import {
  buildTeamCourt,
  buildTeamFormation,
  type MatchChip,
} from "./matchFormation";

// Goalkeepers get their own ring colour so they read distinctly from outfielders
// of either team (mirrors how broadcast graphics treat the keeper).
const GK_RING = "#e2c368";

type RenderChip = MatchChip & { color: string };

// Surname only, so the label stays inside the chip footprint.
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

// Football uses the purpose-built layout; basketball reuses the court placer.
function teamChips(
  lineup: LineupPlayer[],
  side: "home" | "away",
  sport: "football" | "basketball",
  color: string,
  reportedFormation?: string | null,
): { label: string; chips: RenderChip[] } {
  const { label, chips } =
    sport === "basketball"
      ? buildTeamCourt(lineup, side)
      : buildTeamFormation(lineup, side, reportedFormation);
  return {
    label,
    chips: chips.map((c) => ({ ...c, color: c.isGk ? GK_RING : color })),
  };
}

function PitchChip({ chip, index }: { chip: RenderChip; index: number }) {
  return (
    <div
      className="pop-in absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{
        left: `${chip.x * 100}%`,
        top: `${chip.y * 100}%`,
        animationDelay: `${Math.min(index, 11) * 35}ms`,
      }}
    >
      <div
        className="relative h-9 w-9 rounded-full p-[2px] shadow-[0_4px_12px_rgba(0,0,0,0.45)] sm:h-11 sm:w-11"
        style={{ background: chip.color }}
      >
        <div className="h-full w-full overflow-hidden rounded-full bg-surface-1">
          <PlayerAvatar
            name={chip.name}
            photoUrl={chip.photoUrl}
            size="sm"
            className="!h-full !w-full !rounded-full !border-0 !bg-transparent"
          />
        </div>
        {/* Ink on a dark chip rather than on the brand fill — 7px type needs
            more contrast than a brand colour is allowed to carry. */}
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-[2px] bg-surface-0 px-1 py-px font-sans text-[7px] font-700 uppercase leading-none tracking-[0.5px] text-fg-1"
          style={{ border: `1px solid ${chip.color}` }}
        >
          {chip.role}
        </span>
      </div>
      <span className="max-w-16 truncate rounded-[2px] bg-black/55 px-1 py-0.5 text-center font-sans text-[9px] font-700 uppercase leading-none tracking-[0.5px] text-white backdrop-blur-xs">
        {shortName(chip.name)}
      </span>
    </div>
  );
}

function TeamHeader({
  teamName,
  label,
  color,
  align,
}: {
  teamName: string;
  label: string;
  color: string;
  align: "left" | "right";
}) {
  const isRight = align === "right";
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${isRight ? "flex-row-reverse text-right" : ""}`}
    >
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
      <div className="min-w-0">
        <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
          {teamName}
        </p>
        <p className="section-label mt-0.5 tabular-nums">{label}</p>
      </div>
    </div>
  );
}

function Bench({
  teamName,
  players,
  color,
  align,
}: {
  teamName: string;
  players: LineupPlayer[];
  color: string;
  align: "left" | "right";
}) {
  const isRight = align === "right";
  if (players.length === 0) return null;
  return (
    <div>
      <p className={`section-label mb-2.5 ${isRight ? "text-right" : ""}`}>
        {teamName} · Bench
      </p>
      <ul className="space-y-2">
        {players.map((p) => (
          <li
            key={p.player_id}
            className={`flex items-center gap-2.5 ${isRight ? "flex-row-reverse text-right" : ""}`}
          >
            <div
              className="h-7 w-7 shrink-0 rounded-full p-px"
              style={{ background: `${color}80` }}
            >
              <div className="h-full w-full overflow-hidden rounded-full bg-surface-1">
                <PlayerAvatar
                  name={p.name ?? "Unknown"}
                  photoUrl={p.photo_url}
                  size="sm"
                  className="!h-full !w-full !rounded-full !border-0 !bg-transparent !text-[8px]"
                />
              </div>
            </div>
            <span className="truncate text-sm text-fg-2">{p.name ?? "Unknown"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MatchLineupPitch() {
  const sport = useMatchStore((s) => s.sport);
  const startingLineups = useMatchStore((s) => s.startingLineups);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);

  const normalizedSport = (sport ?? "").toLowerCase();
  const lineupSport =
    normalizedSport === "football"
      ? ("football" as const)
      : normalizedSport === "basketball"
        ? ("basketball" as const)
        : null;

  // Cricket / unknown sports have no pitch layout yet — fall back to the list.
  if (lineupSport === null) {
    return <LineupsCard />;
  }

  // The pitch keeps every starter (unmapped ones get slotted into an open line
  // by buildTeamFormation); the bench list only drops fully-unmapped rows, where
  // a nameless entry would read as noise.
  const { home, away } = startingLineups;
  const home_bench = (startingLineups.home_bench ?? []).filter((p) => p.name);
  const away_bench = (startingLineups.away_bench ?? []).filter((p) => p.name);
  if (home.length === 0 && away.length === 0) {
    return (
      <div className="card-surface p-5">
        <PanelEmpty
          icon={<ShieldIcon className="size-5" />}
          title="Lineups not available"
          hint="Confirmed lineups appear here about an hour before kick-off."
        />
      </div>
    );
  }

  const homeName = homeTeam ?? "Home";
  const awayName = awayTeam ?? "Away";
  const identities = matchIdentities(homeName, awayName);
  const homeColor = identities.home.color;
  const awayColor = identities.away.color;
  const homeSide = teamChips(
    home, "home", lineupSport, homeColor, startingLineups.home_formation,
  );
  const awaySide = teamChips(
    away, "away", lineupSport, awayColor, startingLineups.away_formation,
  );
  const Surface =
    lineupSport === "basketball" ? MatchCourtSurface : MatchPitchSurface;

  return (
    <div className="card-surface p-4 sm:p-5">
      {/* Home first, matching ScoreTicker / LineupsCard / LiveMatchClient —
          this component used to render away first, so the same page showed the
          two teams in opposite orders. Home is also the top half of the pitch. */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <TeamHeader teamName={homeName} label={homeSide.label} color={homeColor} align="left" />
        <span className="section-label shrink-0 px-2">vs</span>
        <TeamHeader teamName={awayName} label={awaySide.label} color={awayColor} align="right" />
      </div>

      <Surface className="max-w-[440px]">
        {awaySide.chips.map((chip, i) => (
          <PitchChip key={chip.id} chip={chip} index={i} />
        ))}
        {homeSide.chips.map((chip, i) => (
          <PitchChip key={chip.id} chip={chip} index={i} />
        ))}
      </Surface>

      {(home_bench.length > 0 || away_bench.length > 0) && (
        <div className="mt-5 grid grid-cols-2 gap-5 border-t border-white/8 pt-5">
          <Bench teamName={homeName} players={home_bench} color={homeColor} align="left" />
          <Bench teamName={awayName} players={away_bench} color={awayColor} align="right" />
        </div>
      )}
    </div>
  );
}

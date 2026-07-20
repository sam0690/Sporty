"use client";

import {
  PlayerCard,
  type Sport,
} from "./PlayerCard";
import {
  BasketballGlyph,
  CricketGlyph,
  FootballGlyph,
} from "@/components/landing/sport-icons";
import { POSITION_LABELS } from "@/lib/playerPositions";

type LeaguePlayer = {
  id: string;
  name: string;
  sport: Sport;
  position: string;
  realTeam: string;
  photoUrl?: string | null;
  realTeamLogoUrl?: string | null;
  cost: string;
  totalPoints: number;
  avgPoints: number;
  gameweekPoints: number;
  teamName?: string;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
};

type LeagueGroupProps = {
  leagueName: string;
  players: LeaguePlayer[];
  sports: Sport[];
};

const SPORT_META: Record<Sport, { Icon: typeof FootballGlyph; color: string; label: string }> = {
  football: { Icon: FootballGlyph, color: "#00ff88", label: "Football" },
  basketball: { Icon: BasketballGlyph, color: "#ff6b35", label: "Basketball" },
  cricket: { Icon: CricketGlyph, color: "#00d4ff", label: "Cricket" },
};

// Sensible team-sheet order across sports; unknown codes fall to the end.
const POSITION_ORDER = [
  "GKP", "GK", "DEF", "D", "MID", "M", "FWD", "F", "ATT", "ST",
  "PG", "SG", "SF", "PF", "C", "G",
  "BAT", "BOWL", "AR", "WK",
];

function groupByPosition(players: LeaguePlayer[]) {
  const groups = new Map<string, LeaguePlayer[]>();
  for (const player of players) {
    const key = player.position || "—";
    const list = groups.get(key) ?? [];
    list.push(player);
    groups.set(key, list);
  }
  const rank = (pos: string) => {
    const i = POSITION_ORDER.indexOf(pos.toUpperCase());
    return i < 0 ? 999 : i;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([position, ps]) => ({
      position,
      players: ps.sort((x, y) => y.totalPoints - x.totalPoints),
    }));
}

export function LeagueGroup({ players, sports }: LeagueGroupProps) {
  const sportCounts = sports.map((sport) => ({
    sport,
    count: players.filter((player) => player.sport === sport).length,
  }));
  const positionGroups = groupByPosition(players);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {sportCounts.map(({ sport, count }) => {
            const meta = SPORT_META[sport];
            const Icon = meta.Icon;
            return (
              <span
                key={sport}
                className="inline-flex items-center gap-1.5 font-sans text-xs font-700 uppercase tracking-[1px]"
                style={{ color: meta.color }}
              >
                <Icon className="size-3.5 shrink-0" />
                {meta.label} <span className="num text-fg-3">{count}</span>
              </span>
            );
          })}
        </div>
        <span className="font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
          {players.length} players
        </span>
      </div>

      <div className="space-y-5">
        {positionGroups.map(({ position, players: groupPlayers }) => (
          <div key={position} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-sans text-xs font-700 uppercase tracking-[2px] text-fg-2">
                {POSITION_LABELS[position.toUpperCase()] ?? position}
              </h3>
              <span className="font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
                {groupPlayers.length}
              </span>
              <span className="h-px flex-1 bg-white/6" />
            </div>
            <div className="space-y-2">
              {groupPlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  id={player.id}
                  name={player.name}
                  sport={player.sport}
                  position={player.position}
                  realTeam={player.realTeam}
                  photoUrl={player.photoUrl}
                  realTeamLogoUrl={player.realTeamLogoUrl}
                  cost={player.cost}
                  totalPoints={player.totalPoints}
                  avgPoints={player.avgPoints}
                  gameweekPoints={player.gameweekPoints}
                  teamName={player.teamName}
                  isCaptain={player.isCaptain}
                  isViceCaptain={player.isViceCaptain}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export type { LeaguePlayer, LeagueGroupProps };

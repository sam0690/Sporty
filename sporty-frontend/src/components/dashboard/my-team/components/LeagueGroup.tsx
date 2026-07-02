"use client";

import {
  PlayerCard,
  type Sport,
} from "@/components/dashboard/my-team/components/PlayerCard";

type LeaguePlayer = {
  id: string;
  name: string;
  sport: Sport;
  position: string;
  realTeam: string;
  cost: string;
  totalPoints: number;
  avgPoints: number;
  gameweekPoints: number;
  teamName?: string;
};

type LeagueGroupProps = {
  leagueName: string;
  players: LeaguePlayer[];
  sports: Sport[];
};

const sportAccent: Record<Sport, string> = {
  football: "#4caf50",
  basketball: "#ff6b00",
  cricket: "#00d4ff",
};

const sportLabel: Record<Sport, string> = {
  football: "Football",
  basketball: "Basketball",
  cricket: "Cricket",
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
        <div className="flex flex-wrap items-center gap-2">
          {sportCounts.map(({ sport, count }) => {
            const accent = sportAccent[sport] ?? "#9a9aa5";
            return (
              <span
                key={sport}
                className="rounded-[3px] px-2.5 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px]"
                style={{ color: accent, background: `${accent}1f` }}
              >
                {sportLabel[sport]} · {count}
              </span>
            );
          })}
        </div>
        <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#555560]">
          {players.length} players
        </span>
      </div>

      <div className="space-y-5">
        {positionGroups.map(({ position, players: groupPlayers }) => (
          <div key={position} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#9a9aa5]">
                {position}
              </h3>
              <span className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#555560]">
                {groupPlayers.length}
              </span>
              <span className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
            </div>
            <div className="space-y-2">
              {groupPlayers.map((player) => (
                <PlayerCard
                  key={player.id}
                  name={player.name}
                  sport={player.sport}
                  position={player.position}
                  realTeam={player.realTeam}
                  cost={player.cost}
                  totalPoints={player.totalPoints}
                  avgPoints={player.avgPoints}
                  gameweekPoints={player.gameweekPoints}
                  teamName={player.teamName}
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

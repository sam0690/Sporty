import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type {
  TeamPlayer,
  TeamPreviewSlide,
} from "@/components/dashboard/main-dashboard/types";

type TeamPreviewProps = {
  slides: TeamPreviewSlide[];
  isLoading: boolean;
  isError: boolean;
  hasLeagues: boolean;
};

function groupByFormation(players: TeamPlayer[]) {
  return players.reduce<{
    goalkeepers: TeamPlayer[];
    defenders: TeamPlayer[];
    midfielders: TeamPlayer[];
    forwards: TeamPlayer[];
    others: TeamPlayer[];
  }>(
    (acc, player) => {
      const pos = player.position.toUpperCase();
      if (pos.includes("GK") || pos === "G") {
        acc.goalkeepers.push(player);
      } else if (pos.includes("DEF") || pos === "D") {
        acc.defenders.push(player);
      } else if (pos.includes("MID") || pos === "M") {
        acc.midfielders.push(player);
      } else if (pos.includes("FWD") || pos.includes("ATT") || pos === "F") {
        acc.forwards.push(player);
      } else {
        acc.others.push(player);
      }
      return acc;
    },
    {
      goalkeepers: [],
      defenders: [],
      midfielders: [],
      forwards: [],
      others: [],
    },
  );
}

function inferSportIcon(position: string): string {
  const upper = position.toUpperCase();
  if (
    upper.includes("PG") ||
    upper.includes("SG") ||
    upper.includes("SF") ||
    upper.includes("PF") ||
    upper === "C" ||
    upper.includes("GUARD") ||
    upper.includes("CENTER")
  ) {
    return "🏀";
  }
  return "⚽";
}

function inferSportName(player: TeamPlayer): "football" | "basketball" {
  const explicit = player.sportName?.toLowerCase();
  if (explicit === "basketball") {
    return "basketball";
  }
  if (explicit === "football") {
    return "football";
  }

  const upper = player.position.toUpperCase();
  if (
    upper.includes("PG") ||
    upper.includes("SG") ||
    upper.includes("SF") ||
    upper.includes("PF") ||
    upper === "C" ||
    upper.includes("GUARD") ||
    upper.includes("CENTER")
  ) {
    return "basketball";
  }

  return "football";
}

function PlayerChip({ player }: { player: TeamPlayer }) {
  const sportIcon = inferSportIcon(player.position);

  return (
    <div className="relative flex flex-col items-center text-white">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white text-xl shadow-md">
        <span>{sportIcon}</span>
        {player.isCaptain ? (
          <span className="absolute -left-1.5 -top-1.5 rounded-full border border-yellow-200 bg-yellow-300 px-1.5 py-0.5 text-[9px] font-bold leading-none text-yellow-900">
            C
          </span>
        ) : null}
        {player.isViceCaptain ? (
          <span className="absolute -right-1.5 -top-1.5 rounded-full border border-sky-200 bg-sky-300 px-1.5 py-0.5 text-[9px] font-bold leading-none text-sky-900">
            VC
          </span>
        ) : null}
      </div>
      <p className="mt-1 w-22 truncate text-center text-xs font-medium">
        {player.name}
      </p>
      <p className="text-[10px] text-white/75">{player.position}</p>
      <p className="text-[10px] text-white/75">
        {typeof player.points === "number" ? `${player.points} pts` : "0 pts"}
      </p>
    </div>
  );
}

function rowPositions(count: number): string[] {
  if (count <= 1) return ["left-1/2 -translate-x-1/2"];
  if (count === 2)
    return ["left-[25%] -translate-x-1/2", "left-[75%] -translate-x-1/2"];
  if (count === 3)
    return [
      "left-[17%] -translate-x-1/2",
      "left-1/2 -translate-x-1/2",
      "left-[83%] -translate-x-1/2",
    ];
  if (count === 4)
    return [
      "left-[12%] -translate-x-1/2",
      "left-[38%] -translate-x-1/2",
      "left-[62%] -translate-x-1/2",
      "left-[88%] -translate-x-1/2",
    ];
  if (count === 5)
    return [
      "left-[8%] -translate-x-1/2",
      "left-[28%] -translate-x-1/2",
      "left-1/2 -translate-x-1/2",
      "left-[72%] -translate-x-1/2",
      "left-[92%] -translate-x-1/2",
    ];

  return Array.from({ length: count }, (_, index) => {
    const step = 100 / (count + 1);
    const pct = Math.round((index + 1) * step);
    return `left-[${pct}%] -translate-x-1/2`;
  });
}

function FormationRow({
  players,
  yClass,
}: {
  players: TeamPlayer[];
  yClass: string;
}) {
  const positions = rowPositions(players.length);

  return (
    <>
      {players.map((player, index) => (
        <div
          key={player.id}
          className={`absolute ${yClass} ${positions[index] || "left-1/2 -translate-x-1/2"}`}
        >
          <PlayerChip player={player} />
        </div>
      ))}
    </>
  );
}

function PitchPreview({ players }: { players: TeamPlayer[] }) {
  const hasMultiSport =
    new Set(players.map((player) => inferSportName(player))).size > 1;

  if (hasMultiSport) {
    const basketballPlayers = players.filter(
      (player) => inferSportName(player) === "basketball",
    );
    const footballPlayers = players.filter(
      (player) => inferSportName(player) === "football",
    );

    const footballTopRow = footballPlayers.slice(0, 4);
    const footballBottomRow = footballPlayers.slice(4);

    return (
      <div className="relative mx-auto aspect-3/4 w-full max-w-155 overflow-hidden rounded-2xl bg-linear-to-b from-[#1a4d2e] to-[#0f3a22] px-4 py-3 shadow-xl">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[12%] w-[34%] -translate-x-1/2 border border-white/20" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-[12%] w-[34%] -translate-x-1/2 border border-white/20" />
        <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/20" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-18 w-18 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />

        <FormationRow players={basketballPlayers} yClass="top-[10%]" />
        <FormationRow players={footballTopRow} yClass="top-[56%]" />
        <FormationRow players={footballBottomRow} yClass="top-[83%]" />
      </div>
    );
  }

  const formation = groupByFormation(players);
  const otherPlayers = formation.others;

  return (
    <div className="relative mx-auto aspect-3/4 w-full max-w-155 overflow-hidden rounded-2xl bg-linear-to-b from-[#1a4d2e] to-[#0f3a22] px-4 py-3 shadow-xl">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[12%] w-[34%] -translate-x-1/2 border border-white/20" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[12%] w-[34%] -translate-x-1/2 border border-white/20" />
      <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/20" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-18 w-18 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />

      <FormationRow players={formation.forwards} yClass="top-[10%]" />
      <FormationRow players={formation.midfielders} yClass="top-[30%]" />
      <FormationRow players={formation.defenders} yClass="top-[56%]" />
      <FormationRow players={formation.goalkeepers} yClass="top-[83%]" />
      <FormationRow players={otherPlayers} yClass="top-[44%]" />
    </div>
  );
}

function LoadingPitch() {
  return (
    <div className="relative mx-auto aspect-3/4 w-full max-w-155 animate-pulse overflow-hidden rounded-2xl bg-linear-to-b from-[#1a4d2e] to-[#0f3a22]">
      <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/20" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-18 w-18 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
      {[
        "left-[25%] top-[10%]",
        "left-[75%] top-[10%]",
        "left-[20%] top-[30%]",
        "left-[50%] top-[30%]",
        "left-[80%] top-[30%]",
        "left-[16%] top-[56%]",
        "left-[38%] top-[56%]",
        "left-[62%] top-[56%]",
        "left-[84%] top-[56%]",
        "left-[50%] top-[83%]",
      ].map((slot) => (
        <div
          key={slot}
          className={`absolute ${slot} h-14 w-14 -translate-x-1/2 rounded-full bg-white/80`}
        />
      ))}
    </div>
  );
}

export function TeamPreview({
  slides,
  isLoading,
  isError,
  hasLeagues,
}: TeamPreviewProps) {
  const router = useRouter();
  const activeSlide = slides[0] ?? null;

  const loadingBlocks = useMemo(
    () => Array.from({ length: 2 }, (_, i) => i),
    [],
  );

  return (
    <Card className="rounded-2xl border border-gray-100 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-medium text-gray-900">
          Team Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="space-y-4">
            {loadingBlocks.map((index) => (
              <LoadingPitch key={index} />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load team previews.
          </div>
        ) : !hasLeagues ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            You have not joined a league yet.
          </div>
        ) : !activeSlide ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            No lineup has been set yet.
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              router.push(`/leagues/${activeSlide.leagueId}/lineup`)
            }
            className="w-full rounded-xl border border-gray-200 p-3 text-left transition hover:border-primary-200"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">
                {activeSlide.leagueName}
              </p>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {activeSlide.gameweek
                  ? `GW ${activeSlide.gameweek}`
                  : "Current GW"}
              </span>
            </div>

            <PitchPreview players={activeSlide.players} />
          </button>
        )}
      </CardContent>
    </Card>
  );
}

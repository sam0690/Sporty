import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { PitchSurface } from "@/components/dashboard/shared/pitch/PitchSurface";
import { buildPitchLayout } from "@/components/dashboard/shared/pitch/pitchLayout";
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

function PlayerChip({ player }: { player: TeamPlayer }) {
  const sportIcon = inferSportIcon(player.position);

  return (
    <div className="relative flex flex-col items-center text-white">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/95 text-xl shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
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
      <p className="mt-1 w-22 truncate text-center text-xs font-medium text-foreground">
        {player.name}
      </p>
      <p className="text-[10px] text-white/75">{player.position}</p>
      <p className="text-[10px] text-white/75">
        {typeof player.points === "number" ? `${player.points} pts` : "0 pts"}
      </p>
    </div>
  );
}

function PitchPreview({ players }: { players: TeamPlayer[] }) {
  const { items } = buildPitchLayout(players);

  return (
    <PitchSurface>
      {items.map(({ slot, player }) =>
        player ? (
          <div key={player.id} className={`absolute ${slot.className}`}>
            <PlayerChip player={player} />
          </div>
        ) : null,
      )}
    </PitchSurface>
  );
}

function LoadingPitch() {
  return (
    <PitchSurface className="animate-pulse">
      {[
        "left-[35%] top-[10%]",
        "right-[35%] top-[10%]",
        "left-[15%] top-[30%]",
        "left-[35%] top-[30%]",
        "right-[35%] top-[30%]",
        "right-[15%] top-[30%]",
        "left-[12%] top-[55%]",
        "left-[30%] top-[55%]",
        "right-[30%] top-[55%]",
        "right-[12%] top-[55%]",
        "left-1/2 top-[80%] -translate-x-1/2",
      ].map((slot) => (
        <div
          key={slot}
          className={`absolute ${slot} h-10 w-10 rounded-full bg-white/80 sm:h-14 sm:w-14`}
        />
      ))}
    </PitchSurface>
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
    <Card className="border-white/10 bg-surface/80">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-xl font-bold text-foreground">
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
          <div className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm text-red-300">
            Failed to load team previews.
          </div>
        ) : !hasLeagues ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
            You have not joined a league yet.
          </div>
        ) : !activeSlide ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
            No lineup has been set yet.
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              router.push(`/leagues/${activeSlide.leagueId}/lineup`)
            }
            className="w-full rounded-2xl border border-white/10 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-primary/30 hover:shadow-[0_18px_50px_rgba(0,229,255,0.1)]"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {activeSlide.leagueName}
              </p>
              <span className="rounded-full bg-accent-primary/15 px-2 py-0.5 text-xs font-semibold text-accent-primary">
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

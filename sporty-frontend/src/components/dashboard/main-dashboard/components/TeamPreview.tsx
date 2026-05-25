import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { FormationRenderer } from "@/components/dashboard/shared/formation/FormationRenderer";
import { buildTeamLayout } from "@/components/dashboard/shared/formation/formationEngine";
import { PlayerMarker } from "@/components/dashboard/shared/formation/PlayerMarker";
import type { TeamPreviewSlide } from "@/components/dashboard/main-dashboard/types";

type TeamPreviewProps = {
  slides: TeamPreviewSlide[];
  isLoading: boolean;
  isError: boolean;
  hasLeagues: boolean;
};

function LoadingPitch() {
  return (
    <div className="relative mx-auto aspect-3/4 animate-pulse overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
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
  const layout = activeSlide
    ? buildTeamLayout(activeSlide.players, { activeOnly: true })
    : null;

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
            <LoadingPitch />
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

            {layout ? (
              <FormationRenderer
                layout={layout}
                showSectionLabels={false}
                renderSlot={({ slot }) => {
                  if (!slot.player) {
                    return (
                      <div className="h-10 w-10 rounded-full border border-dashed border-white/15 bg-white/10 sm:h-14 sm:w-14" />
                    );
                  }

                  return (
                    <PlayerMarker
                      name={slot.player.name}
                      position={slot.player.position}
                      sport={slot.player.sport}
                      points={slot.player.points}
                      isCaptain={slot.player.isCaptain}
                      isViceCaptain={slot.player.isViceCaptain}
                    />
                  );
                }}
              />
            ) : null}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

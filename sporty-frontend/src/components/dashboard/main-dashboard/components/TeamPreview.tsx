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
    <div className="relative mx-auto aspect-3/4 animate-pulse overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26]">
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
          className={`absolute ${slot} h-10 w-10 rounded-[3px] bg-[#333340] sm:h-14 sm:w-14`}
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Team Preview</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <LoadingPitch />
        ) : isError ? (
          <div className="rounded-[3px] border border-[rgba(255,59,48,0.3)] bg-[#2a1010] p-4 text-sm text-[#ff3b30]">
            Failed to load team previews.
          </div>
        ) : !hasLeagues ? (
          <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 text-sm text-[#555560]">
            You have not joined a league yet.
          </div>
        ) : !activeSlide ? (
          <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 text-sm text-[#555560]">
            No lineup has been set yet.
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              router.push(`/leagues/${activeSlide.leagueId}/lineup`)
            }
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] p-3 text-left transition-colors hover:border-[rgba(232,251,37,0.3)]"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#f0f0f0]">
                {activeSlide.leagueName}
              </p>
              <span className="rounded-[3px] border border-[rgba(232,251,37,0.25)] bg-[#1a1a10] px-2 py-0.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#c8d85a]">
                {activeSlide.gameweek ? `GW ${activeSlide.gameweek}` : "Current GW"}
              </span>
            </div>

            {layout ? (
              <FormationRenderer
                layout={layout}
                showSectionLabels={false}
                renderSlot={({ slot }) => {
                  if (!slot.player) {
                    return (
                      <div className="h-10 w-10 rounded-[3px] border border-dashed border-[rgba(255,255,255,0.15)] bg-[#1d1d26] sm:h-14 sm:w-14" />
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

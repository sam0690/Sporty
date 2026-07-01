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
    <div className="relative mx-auto aspect-3/4 animate-pulse overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7]">
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
          className={`absolute ${slot} h-10 w-10 rounded-[3px] bg-[#EAECF0] sm:h-14 sm:w-14`}
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
          <div className="rounded-[3px] border border-[rgba(255,59,48,0.3)] bg-[#FEE2E2] p-4 text-sm text-[#DC2626]">
            Failed to load team previews.
          </div>
        ) : !hasLeagues ? (
          <div className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-4 text-sm text-[#6B7280]">
            You have not joined a league yet.
          </div>
        ) : !activeSlide ? (
          <div className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-4 text-sm text-[#6B7280]">
            No lineup has been set yet.
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              router.push(`/leagues/${activeSlide.leagueId}/lineup`)
            }
            className="w-full rounded-[3px] border border-[rgba(11,18,32,0.08)] p-3 text-left transition-colors hover:border-[rgba(220,38,38,0.3)]"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-barlow-condensed text-sm font-bold uppercase tracking-[1px] text-[#0B1220]">
                {activeSlide.leagueName}
              </p>
              <span className="rounded-[3px] border border-[rgba(220,38,38,0.25)] bg-[#FEE2E2] px-2 py-0.5 font-barlow-condensed text-xs font-bold uppercase tracking-[1px] text-[#B91C1C]">
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
                      <div className="h-10 w-10 rounded-[3px] border border-dashed border-[rgba(11,18,32,0.15)] bg-[#F3F4F7] sm:h-14 sm:w-14" />
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

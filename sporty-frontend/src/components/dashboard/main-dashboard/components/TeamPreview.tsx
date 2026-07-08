import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { sportGlyph } from "@/components/landing/sport-icons";
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
    <div className="skeleton relative mx-auto aspect-3/4 overflow-hidden rounded-[10px] border border-[rgba(255,255,255,0.08)]">
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
          className={`absolute ${slot} h-10 w-10 rounded-[8px] bg-white/[0.04] sm:h-14 sm:w-14`}
        />
      ))}
    </div>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#1a1a22] p-4 text-sm text-[#777783]">
      {children}
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
  const primarySport = activeSlide?.players[0]?.sport;
  const glyph = sportGlyph(primarySport);
  const Glyph = glyph.Icon;

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#121218] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_18px_40px_-26px_rgba(0,0,0,0.9)]">
      <div
        aria-hidden
        className="h-[2px] w-full"
        style={{ background: `linear-gradient(90deg, ${glyph.color}, transparent 80%)` }}
      />
      <header className="flex items-center gap-2.5 border-b border-[rgba(255,255,255,0.07)] px-5 py-4">
        <span
          className="grid size-6 shrink-0 place-items-center rounded-[6px]"
          style={{ color: glyph.color, background: `${glyph.color}1a` }}
        >
          <Glyph className="size-3.5" />
        </span>
        <h2 className="font-barlow-condensed text-sm font-700 uppercase tracking-[2px] text-[#d7d7de]">
          Team Preview
        </h2>
      </header>

      <div className="flex-1 p-5">
        {isLoading ? (
          <LoadingPitch />
        ) : isError ? (
          <EmptyPanel>
            <span className="text-[#ff3b5c]">Failed to load team previews.</span>
          </EmptyPanel>
        ) : !hasLeagues ? (
          <EmptyPanel>You have not joined a league yet.</EmptyPanel>
        ) : !activeSlide ? (
          <EmptyPanel>No lineup has been set yet.</EmptyPanel>
        ) : (
          <button
            type="button"
            onClick={() =>
              router.push(`/leagues/${activeSlide.leagueId}/lineup`)
            }
            className="group w-full rounded-[10px] border border-[rgba(255,255,255,0.08)] p-3 text-left transition-colors hover:border-[rgba(232,251,37,0.3)]"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#f0f0f0]">
                {activeSlide.leagueName}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-[rgba(232,251,37,0.25)] bg-[rgba(232,251,37,0.08)] px-2.5 py-0.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#c8d85a]">
                  {activeSlide.gameweek ? `GW ${activeSlide.gameweek}` : "Current GW"}
                </span>
                <ChevronRight className="size-4 text-[#555560] transition-colors group-hover:text-[#e8fb25]" />
              </div>
            </div>

            {layout ? (
              <FormationRenderer
                layout={layout}
                showSectionLabels={false}
                renderSlot={({ slot }) => {
                  if (!slot.player) {
                    return (
                      <div className="h-10 w-10 rounded-[8px] border border-dashed border-[rgba(255,255,255,0.15)] bg-white/[0.03] sm:h-14 sm:w-14" />
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
      </div>
    </section>
  );
}

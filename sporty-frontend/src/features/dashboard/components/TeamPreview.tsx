import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardList, Trophy } from "lucide-react";

import { CardErrorState, EmptyState } from "@/components/ui";
import { sportGlyph } from "@/components/landing/sport-icons";
import { FormationRenderer } from "@/components/dashboard/shared/formation/FormationRenderer";
import { buildTeamLayout } from "@/lib/formation/formationEngine";
import { PlayerMarker } from "@/components/dashboard/shared/formation/PlayerMarker";
import type { TeamPreviewSlide } from "../types";

type TeamPreviewProps = {
  slides: TeamPreviewSlide[];
  isLoading: boolean;
  isError: boolean;
  hasLeagues: boolean;
  activeLeagueId: string | null;
  onRetry?: () => void | Promise<unknown>;
};

function LoadingPitch() {
  return (
    <div className="skeleton relative mx-auto aspect-3/4 overflow-hidden rounded-[3px] border border-white/8">
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
          className={`absolute ${slot} h-10 w-10 rounded-[3px] bg-white/[0.04] sm:h-14 sm:w-14`}
        />
      ))}
    </div>
  );
}

const EMPTY_STATE_INSET =
  "!border-transparent !bg-transparent !py-8 !shadow-none";

export function TeamPreview({
  slides,
  isLoading,
  isError,
  hasLeagues,
  activeLeagueId,
  onRetry,
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
    <section className="flex h-full flex-col overflow-hidden card-surface">
      <div aria-hidden className="h-[2px] w-full" style={{ background: glyph.color }} />
      <header className="flex items-center gap-2.5 border-b border-white/7 px-5 py-4">
        <span
          className="grid size-6 shrink-0 place-items-center rounded-[3px]"
          style={{ color: glyph.color, background: `${glyph.color}1a` }}
        >
          <Glyph className="size-3.5" />
        </span>
        <h2 className="font-sans text-sm font-700 uppercase tracking-[2px] text-fg-1">
          Team Preview
        </h2>
      </header>

      <div className="flex-1 p-5" aria-busy={isLoading}>
        {isLoading ? (
          <LoadingPitch />
        ) : isError ? (
          <CardErrorState onRetry={onRetry} />
        ) : !hasLeagues ? (
          <EmptyState
            className={EMPTY_STATE_INSET}
            icon={Trophy}
            title="No leagues yet"
            description="Create or join a league to start building your squad."
            actions={[
              { label: "Create league", href: "/create-league", variant: "primary" },
              { label: "Join league", href: "/join-league" },
            ]}
          />
        ) : !activeSlide ? (
          <EmptyState
            className={EMPTY_STATE_INSET}
            icon={ClipboardList}
            title="No lineup set yet"
            description="Your starting eleven will show up here once you set a lineup."
            actions={
              activeLeagueId
                ? [
                    {
                      label: "Set lineup",
                      href: `/leagues/${activeLeagueId}/lineup`,
                      variant: "primary",
                    },
                  ]
                : []
            }
          />
        ) : (
          <button
            type="button"
            onClick={() =>
              router.push(`/leagues/${activeSlide.leagueId}/lineup`)
            }
            className="group w-full rounded-[3px] border border-white/8 p-3 text-left transition-colors hover:border-accent/30"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="truncate font-sans text-sm font-700 uppercase tracking-[1px] text-fg-1">
                {activeSlide.leagueName}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-[3px] border border-accent/25 bg-accent/8 px-2.5 py-0.5 font-sans text-xs font-700 uppercase tracking-[1px] text-accent-dim">
                  {activeSlide.gameweek ? `GW ${activeSlide.gameweek}` : "Current GW"}
                </span>
                <ChevronRight className="size-4 text-fg-3 transition-colors group-hover:text-accent" />
              </div>
            </div>

            {layout ? (
              <FormationRenderer
                layout={layout}
                showSectionLabels={false}
                renderSlot={({ slot }) => {
                  if (!slot.player) {
                    return (
                      <div className="h-10 w-10 rounded-[3px] border border-dashed border-white/15 bg-white/[0.03] sm:h-14 sm:w-14" />
                    );
                  }
                  return (
                    <PlayerMarker
                      name={slot.player.name}
                      position={slot.player.position}
                      sport={slot.player.sport}
                      photoUrl={slot.player.photoUrl}
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

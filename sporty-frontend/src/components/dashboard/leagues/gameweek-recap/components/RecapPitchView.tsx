"use client";

import { PlayerAvatar } from "@/components/ui";
import { FormationRenderer } from "@/components/dashboard/shared/formation/FormationRenderer";
import { buildTeamLayout } from "@/components/dashboard/shared/formation/formationEngine";
import type {
  TGameweekPlayerRecap,
  TGameweekPlayerStatus,
} from "@/types/league";

type RecapPitchPlayer = {
  id: string;
  name: string;
  position: string;
  sport?: string | null;
  points: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  photoUrl?: string | null;
  status: TGameweekPlayerStatus;
  counted: boolean;
};

function toPitchPlayer(p: TGameweekPlayerRecap): RecapPitchPlayer {
  return {
    id: p.player.id,
    name: p.player.name,
    position: p.player.position,
    sport: p.player.sport?.name,
    points: Number(p.contributed_points) || 0,
    isCaptain: p.is_captain,
    isViceCaptain: p.is_vice_captain,
    photoUrl: p.player.photo_url,
    status: p.status,
    counted: p.counted,
  };
}

function fmtPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function SubArrowOverlay({ dir }: { dir: "in" | "out" }) {
  const color = dir === "in" ? "#00e07f" : "#ff3b5c";
  const d =
    dir === "in" ? "M12 19V5M12 5l-5 5M12 5l5 5" : "M12 5v14M12 19l-5-5M12 19l5-5";
  return (
    <span
      className="absolute -right-1 -top-1 z-10 grid size-4 place-items-center rounded-full ring-1 ring-black/40 sm:size-5"
      style={{ color, background: "#111117", border: `1px solid ${color}59` }}
      aria-label={dir === "in" ? "Subbed in" : "Subbed out"}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={d} />
      </svg>
    </span>
  );
}

// Pitch marker with the points front-and-centre: photo tile (same treatment as
// the lineup pitch), C/VC + sub overlays, name plate, then a prominent points
// plate instead of the position label — the pitch row already conveys position.
function RecapMarker({ p }: { p: RecapPitchPlayer }) {
  const didNotPlay = p.status === "did_not_play";
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        <div
          className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-[3px] border bg-white sm:h-12 sm:w-12 ${
            didNotPlay ? "border-danger/60 opacity-60" : "border-white/20"
          }`}
        >
          <PlayerAvatar
            name={p.name}
            photoUrl={p.photoUrl}
            size="md"
            className="!h-full !w-full !rounded-none !border-0 !bg-transparent"
          />
        </div>

        {p.isCaptain ? (
          <div className="absolute -left-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-[3px] border border-yellow-200 bg-yellow-400 text-[8px] font-700 text-yellow-950 shadow-sm sm:h-5 sm:w-5 sm:text-[10px]">
            C
          </div>
        ) : p.isViceCaptain ? (
          <div className="absolute -left-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-[3px] border border-sky-300 bg-sky-400 text-[8px] font-700 text-sky-950 shadow-sm sm:h-5 sm:w-5 sm:text-[10px]">
            VC
          </div>
        ) : null}

        {p.status === "subbed_in" ? <SubArrowOverlay dir="in" /> : null}
        {p.status === "subbed_out" ? <SubArrowOverlay dir="out" /> : null}
      </div>

      <div className="mt-1.5 flex w-16 flex-col items-center sm:w-20">
        <p className="w-full truncate rounded-sm bg-black/60 px-1 py-0.5 text-center text-[9px] font-700 text-white sm:text-[10px]">
          {p.name}
        </p>
        <p
          className={`mt-0.5 rounded-sm bg-black/60 px-1.5 font-display text-sm leading-tight tracking-[-0.02em] tabular-nums sm:text-base ${
            p.counted ? "text-accent" : "text-[#7a7a85]"
          }`}
        >
          {p.points > 0 ? "+" : ""}
          {fmtPoints(p.points)}
        </p>
      </div>
    </div>
  );
}

export function RecapPitchView({
  players,
}: {
  players: TGameweekPlayerRecap[];
}) {
  const starters = players.filter((p) => p.is_starter).map(toPitchPlayer);
  const bench = players.filter((p) => !p.is_starter).map(toPitchPlayer);

  const layout = buildTeamLayout(starters, { activeOnly: false });

  return (
    <div className="space-y-4">
      <FormationRenderer
        layout={layout}
        showSectionLabels={layout.mode === "mixed"}
        renderSlot={({ slot }) =>
          slot.player ? (
            <RecapMarker p={slot.player} />
          ) : (
            <div className="h-10 w-10 rounded-[3px] border border-dashed border-white/15 bg-white/[0.03] sm:h-12 sm:w-12" />
          )
        }
      />

      {bench.length > 0 ? (
        <section className="overflow-hidden card-surface">
          <header className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <span className="section-label">Bench</span>
            <span className="rounded-[3px] bg-white/6 px-2 py-0.5 font-sans text-[11px] font-700 tabular-nums text-fg-2">
              {bench.length}
            </span>
          </header>
          <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-4 px-4 py-5">
            {bench.map((p) => (
              <RecapMarker key={p.id} p={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

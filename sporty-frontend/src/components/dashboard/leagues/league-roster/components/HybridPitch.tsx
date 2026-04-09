"use client";

import type { Player } from "@/components/dashboard/leagues/league-roster/components/PlayerCard";
import {
  PitchSlot,
  type PitchSlotConfig,
} from "@/components/dashboard/leagues/league-roster/components/PitchSlot";

type SportCount = {
  football: number;
  basketball: number;
  cricket: number;
};

type HybridPitchProps = {
  slotAssignments: Record<number, Player | null>;
  onRemoveFromSlot: (slotId: number) => void;
  activeCountsPerSport: SportCount;
  isMultiSport: boolean;
  canDropToSlot: (slotId: number) => boolean;
  onSelectPlayer?: (playerId: number) => void;
  selectedPlayerId?: number | null;
};

type PitchSpot = {
  id: number;
  className: string;
};

const slotConfigs: PitchSlotConfig[] = [
  { id: 1, label: "Forward / Captain", shortLabel: "P1" },
  { id: 2, label: "Left Wing", shortLabel: "P2" },
  { id: 3, label: "Right Wing", shortLabel: "P3" },
  { id: 4, label: "Playmaker", shortLabel: "P4" },
  { id: 5, label: "Left Mid", shortLabel: "P5" },
  { id: 6, label: "Right Mid", shortLabel: "P6" },
  { id: 7, label: "Left Back", shortLabel: "P7" },
  { id: 8, label: "Right Back", shortLabel: "P8" },
  { id: 9, label: "Goalkeeper / Sweeper", shortLabel: "P9" },
];

const pitchSpots: PitchSpot[] = [
  { id: 1, className: "left-1/2 top-[8%] -translate-x-1/2" },
  { id: 2, className: "left-[20%] top-[25%]" },
  { id: 3, className: "right-[20%] top-[25%]" },
  { id: 4, className: "left-1/2 top-[44%] -translate-x-1/2" },
  { id: 5, className: "left-[15%] top-[49%]" },
  { id: 6, className: "right-[15%] top-[49%]" },
  { id: 7, className: "left-[25%] top-[72%]" },
  { id: 8, className: "right-[25%] top-[72%]" },
  { id: 9, className: "left-1/2 top-[84%] -translate-x-1/2" },
];

export function HybridPitch({
  slotAssignments,
  onRemoveFromSlot,
  activeCountsPerSport,
  isMultiSport,
  canDropToSlot,
  onSelectPlayer,
  selectedPlayerId,
}: HybridPitchProps) {
  return (
    <section className="w-full max-w-2xl mx-auto [animation:fade-soft_0.2s_ease]">
      {isMultiSport ? (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span
            className={`rounded-full border px-3 py-1 ${activeCountsPerSport.football === 3 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}
          >
            ⚽ {activeCountsPerSport.football}/3
          </span>
          <span
            className={`rounded-full border px-3 py-1 ${activeCountsPerSport.basketball === 3 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}
          >
            🏀 {activeCountsPerSport.basketball}/3
          </span>
          <span
            className={`rounded-full border px-3 py-1 ${activeCountsPerSport.cricket === 3 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}
          >
            🏏 {activeCountsPerSport.cricket}/3
          </span>
        </div>
      ) : null}

      <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#1a4d2e] to-[#0f3a22] shadow-xl">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[12%] w-[34%] -translate-x-1/2 border border-white/20" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-[12%] w-[34%] -translate-x-1/2 border border-white/20" />
        <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/20" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 sm:h-24 sm:w-24" />

        <div className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-12 -translate-x-1/2 -translate-y-1/2 bg-amber-800/40" />

        <div className="pointer-events-none absolute left-[8%] top-[12%] h-[76%] w-[84%] rounded-md border border-orange-400/20" />
        <div className="pointer-events-none absolute left-1/2 top-[7%] h-16 w-16 -translate-x-1/2 rounded-full border border-orange-400/20 sm:h-20 sm:w-20" />
        <div className="pointer-events-none absolute bottom-[4%] left-1/2 h-16 w-16 -translate-x-1/2 rounded-full border border-orange-400/20 sm:h-20 sm:w-20" />

        {pitchSpots.map((spot) => {
          const slot = slotConfigs.find((item) => item.id === spot.id);
          const player = slotAssignments[spot.id] ?? null;
          if (!slot) {
            return null;
          }

          return (
            <div key={spot.id} className={`absolute ${spot.className}`}>
              <PitchSlot
                slot={slot}
                player={player}
                dropId={`slot-${spot.id}`}
                isDropDisabled={!canDropToSlot(spot.id)}
                onRemove={onRemoveFromSlot}
                onSelectPlayer={onSelectPlayer}
                isSelected={!!player && selectedPlayerId === player.id}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs text-gray-400">
        Drag players into slots. Drag slotted players to bench list or other
        slots.
      </p>
    </section>
  );
}

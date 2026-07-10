"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PlayerDetailContent } from "@/components/shared/player-detail/PlayerDetailContent";

type PlayerDetailPageViewProps = {
  playerId: string;
};

export function PlayerDetailPageView({ playerId }: PlayerDetailPageViewProps) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 rounded-[3px] px-2 py-1.5 text-sm text-[#9a9aa5] transition-colors hover:text-[#f0f0f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8fb25]/60"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <div className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] text-[#f0f0f0]">
        <PlayerDetailContent playerId={playerId} />
      </div>
    </div>
  );
}

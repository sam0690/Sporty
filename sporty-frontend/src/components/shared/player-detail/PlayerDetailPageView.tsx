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
        className="mb-4 flex items-center gap-2 rounded-[3px] px-2 py-1.5 text-sm text-fg-2 transition-colors hover:text-fg-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <div className="overflow-hidden card-surface text-fg-1">
        <PlayerDetailContent playerId={playerId} />
      </div>
    </div>
  );
}

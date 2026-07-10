"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { PlayerDetailContent } from "@/components/shared/player-detail/PlayerDetailContent";

type PlayerDetailModalRouteProps = {
  playerId: string;
};

export function PlayerDetailModalRoute({ playerId }: PlayerDetailModalRouteProps) {
  const router = useRouter();
  const close = () => router.back();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="pop-in max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] text-[#f0f0f0]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <button
            type="button"
            onClick={close}
            aria-label="Close player details"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#9a9aa5] transition-colors hover:bg-[#25252f] hover:text-[#f0f0f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8fb25]/60"
          >
            <X className="h-4 w-4" />
          </button>
          <PlayerDetailContent playerId={playerId} />
        </div>
      </div>
    </div>
  );
}

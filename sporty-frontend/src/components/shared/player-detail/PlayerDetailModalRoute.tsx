"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { PlayerDetailContent } from "@/components/shared/player-detail/PlayerDetailContent";

type PlayerDetailModalRouteProps = {
  playerId: string;
};

// Matches the .pop-out keyframe duration in globals.css — exit animates
// before the route actually unmounts so it's visible.
const EXIT_DURATION_MS = 180;

export function PlayerDetailModalRoute({ playerId }: PlayerDetailModalRouteProps) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);

  const close = () => {
    if (closing) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      router.back();
      return;
    }
    setClosing(true);
    window.setTimeout(() => router.back(), EXIT_DURATION_MS);
  };

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
        className={`${closing ? "pop-out" : "pop-in"} max-h-[85vh] w-full max-w-lg overflow-y-auto card-surface text-fg-1`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <button
            type="button"
            onClick={close}
            aria-label="Close player details"
            className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-[3px] border border-white/8 bg-surface-3 text-fg-2 transition-colors hover:bg-[#25252f] hover:text-fg-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <X className="h-4 w-4" />
          </button>
          <PlayerDetailContent playerId={playerId} />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMatchStore } from "@/store/matchStore";

export function ScoreTicker() {
  const score = useMatchStore((s) => s.score);
  const status = useMatchStore((s) => s.status);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="text-xs uppercase tracking-wider text-foreground/55">
        Live Score
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-3xl font-semibold text-foreground">
          {score.home}
        </div>
        <div className="text-sm font-medium text-foreground/55">{status}</div>
        <div className="text-3xl font-semibold text-foreground">
          {score.away}
        </div>
      </div>
    </div>
  );
}

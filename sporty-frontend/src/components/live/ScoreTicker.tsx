"use client";

import { useMatchStore } from "@/store/matchStore";

export function ScoreTicker() {
  const score = useMatchStore((s) => s.score);
  const status = useMatchStore((s) => s.status);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        Live Score
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-3xl font-semibold text-slate-900">
          {score.home}
        </div>
        <div className="text-sm font-medium text-slate-500">{status}</div>
        <div className="text-3xl font-semibold text-slate-900">
          {score.away}
        </div>
      </div>
    </div>
  );
}

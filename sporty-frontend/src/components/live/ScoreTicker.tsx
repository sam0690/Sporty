"use client";

import { useMatchStore } from "@/store/matchStore";

function describeStatus(status: string): { label: string; live: boolean } {
  const s = status.toLowerCase();
  if (s === "live" || s === "in_progress" || s === "playing") {
    return { label: "Live", live: true };
  }
  if (s === "finished" || s === "ft" || s === "completed") {
    return { label: "Full Time", live: false };
  }
  if (s === "scheduled" || s === "upcoming") {
    return { label: "Kick Off Soon", live: false };
  }
  return { label: status.replace(/_/g, " "), live: false };
}

export function ScoreTicker() {
  const score = useMatchStore((s) => s.score);
  const status = useMatchStore((s) => s.status);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);

  const { label, live } = describeStatus(status);

  return (
    <section className="glass-strong relative overflow-hidden rounded-2xl p-6">
      {/* Ambient neon halo behind the scoreline */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-28 h-56 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in oklab, var(--football) 22%, transparent), transparent 70%)",
        }}
      />

      <div className="relative flex items-center justify-between">
        {live ? (
          <span className="live-badge">Live</span>
        ) : (
          <span className="section-label">{label}</span>
        )}
        <span className="section-label">Match Centre</span>
      </div>

      <div className="relative mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="min-w-0 text-right">
          <div className="truncate text-lg font-700 text-foreground sm:text-xl">
            {homeTeam ?? "Home"}
          </div>
          <div className="micro-label mt-1 text-football">Home</div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <span className="stat-box-number text-5xl sm:text-6xl">{score.home}</span>
          <span className="text-2xl font-700 text-muted-foreground">:</span>
          <span className="stat-box-number text-5xl sm:text-6xl">{score.away}</span>
        </div>

        <div className="min-w-0 text-left">
          <div className="truncate text-lg font-700 text-foreground sm:text-xl">
            {awayTeam ?? "Away"}
          </div>
          <div className="micro-label mt-1 text-basketball">Away</div>
        </div>
      </div>

      {!live && (
        <div className="relative mt-5 flex justify-center">
          <span className="rounded-full border border-border bg-white/5 px-3 py-1 text-xs font-600 uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
      )}
    </section>
  );
}

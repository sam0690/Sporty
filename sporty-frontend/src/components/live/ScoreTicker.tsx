"use client";

import { useEffect, useState } from "react";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";

function Crest({ name }: { name: string }) {
  const { color, initials } = teamIdentity(name);
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-[3px] font-bebas text-sm leading-none tracking-[1px] sm:size-11 sm:text-base"
      style={{
        color,
        background: `${color}22`,
        border: `1px solid ${color}55`,
      }}
    >
      {initials}
    </span>
  );
}

type Phase = "pre" | "live" | "post";

function describeStatus(status: string): { label: string; phase: Phase } {
  const s = status.toLowerCase();
  if (s === "live" || s === "in_progress" || s === "playing") {
    return { label: "Live", phase: "live" };
  }
  if (s === "finished" || s === "ft" || s === "completed") {
    return { label: "Full Time", phase: "post" };
  }
  return { label: status.replace(/_/g, " ") || "Scheduled", phase: "pre" };
}

export function ScoreTicker({ loading = false }: { loading?: boolean }) {
  const score = useMatchStore((s) => s.score);
  const status = useMatchStore((s) => s.status);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);
  const minute = useMatchStore((s) => s.minute);
  const socketStatus = useMatchStore((s) => s.socketStatus);
  const lastUpdatedTs = useMatchStore((s) => s.lastUpdatedTs);

  const { label, phase } = describeStatus(status);

  // Tick once a second so the freshness indicator stays current.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const agoSec = lastUpdatedTs
    ? Math.max(0, Math.round((now - lastUpdatedTs) / 1000))
    : null;

  if (loading) {
    return (
      <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
        <div className="h-12 border-b border-[rgba(255,255,255,0.08)]" />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-8">
          <div className="ml-auto h-6 w-28 animate-pulse rounded bg-[#1d1d26]" />
          <div className="h-12 w-28 animate-pulse rounded bg-[#1d1d26]" />
          <div className="h-6 w-28 animate-pulse rounded bg-[#1d1d26]" />
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
        {phase === "live" ? (
          <span className="inline-flex items-center gap-1.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[2px] text-[#ff3b30]">
            <span className="size-1.5 rounded-full bg-[#ff3b30] animate-live-pulse" />
            Live
          </span>
        ) : (
          <span className="section-label">{label}</span>
        )}

        <span className="inline-flex items-center gap-3 text-[10px] font-700 uppercase tracking-[1.5px]">
          {phase === "live" && (
            <span
              className={
                socketStatus === "live"
                  ? "text-[#4caf50]"
                  : "text-[#ffd86b]"
              }
            >
              {socketStatus === "live"
                ? "● Connected"
                : socketStatus === "reconnecting"
                  ? "○ Reconnecting"
                  : "○ Connecting"}
            </span>
          )}
          {agoSec != null && phase !== "pre" && (
            <span className="text-[#555560]">
              {agoSec < 2 ? "Just now" : `${agoSec}s ago`}
            </span>
          )}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-8 sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center justify-end gap-2.5">
            <p className="truncate text-right font-barlow-condensed text-lg font-700 uppercase tracking-[0.5px] text-[#f0f0f0] sm:text-2xl">
              {homeTeam ?? "Home"}
            </p>
            <Crest name={homeTeam ?? "Home"} />
          </div>
          <p className="section-label mt-1.5 text-right">Home</p>
        </div>

        <div className="shrink-0 text-center">
          <div className="font-bebas text-5xl leading-none tracking-[3px] text-[#e8fb25] sm:text-7xl">
            {score.home}
            <span className="px-2 text-[#555560]">-</span>
            {score.away}
          </div>
          {phase === "live" && minute != null && (
            <p className="mt-2 inline-flex items-center gap-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#ff3b30]">
              <span className="size-1 rounded-full bg-[#ff3b30] animate-live-pulse" />
              {minute}&apos;
            </p>
          )}
          {phase === "post" && (
            <p className="section-label mt-2">Full Time</p>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-start gap-2.5">
            <Crest name={awayTeam ?? "Away"} />
            <p className="truncate font-barlow-condensed text-lg font-700 uppercase tracking-[0.5px] text-[#f0f0f0] sm:text-2xl">
              {awayTeam ?? "Away"}
            </p>
          </div>
          <p className="section-label mt-1.5">Away</p>
        </div>
      </div>
    </section>
  );
}

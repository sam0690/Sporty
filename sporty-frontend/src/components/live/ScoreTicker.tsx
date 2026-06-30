"use client";

import { useEffect, useState } from "react";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";

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

function Crest({ name, color, initials }: { name: string; color: string; initials: string }) {
  return (
    <span
      className="grid size-12 shrink-0 place-items-center rounded-[4px] font-bebas text-base leading-none tracking-[1px] sm:size-16 sm:text-2xl"
      style={{
        color,
        background: `${color}22`,
        border: `1px solid ${color}66`,
        boxShadow: `0 0 28px ${color}1f`,
      }}
      aria-label={name}
    >
      {initials}
    </span>
  );
}

export function ScoreTicker({ loading = false }: { loading?: boolean }) {
  const score = useMatchStore((s) => s.score);
  const status = useMatchStore((s) => s.status);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);
  const minute = useMatchStore((s) => s.minute);
  const minuteStartedTs = useMatchStore((s) => s.minuteStartedTs);
  const socketStatus = useMatchStore((s) => s.socketStatus);
  const lastUpdatedTs = useMatchStore((s) => s.lastUpdatedTs);

  const { label, phase } = describeStatus(status);
  const home = teamIdentity(homeTeam ?? "Home");
  const away = teamIdentity(awayTeam ?? "Away");

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const agoSec = lastUpdatedTs
    ? Math.max(0, Math.round((now - lastUpdatedTs) / 1000))
    : null;

  // Match clock as MM:SS — the minute is server-authoritative; the seconds tick
  // up in real time within the current minute (capped at 59 so it never shows a
  // minute the server hasn't reported).
  let matchClock: string | null = null;
  if (minute != null) {
    const secs = minuteStartedTs
      ? Math.min(59, Math.max(0, Math.floor((now - minuteStartedTs) / 1000)))
      : 0;
    matchClock = `${minute}:${String(secs).padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <section className="overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12]">
        <div className="h-1 bg-[#1d1d26]" />
        <div className="h-11 border-b border-[rgba(255,255,255,0.06)]" />
        <div className="flex items-center justify-center gap-6 px-6 py-14">
          <div className="h-16 w-40 animate-pulse rounded bg-[#1d1d26]" />
          <div className="h-16 w-40 animate-pulse rounded bg-[#1d1d26]" />
          <div className="h-16 w-40 animate-pulse rounded bg-[#1d1d26]" />
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12]">
      {/* team-colour split accent */}
      <div className="flex h-1">
        <div className="flex-1" style={{ background: home.color }} />
        <div className="flex-1" style={{ background: away.color }} />
      </div>

      {/* ambient team-colour glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 0% 45%, ${home.color}24, transparent 48%), radial-gradient(120% 90% at 100% 45%, ${away.color}24, transparent 48%)`,
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] px-6 py-3">
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
                  socketStatus === "live" ? "text-[#4caf50]" : "text-[#ffd86b]"
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

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-10 sm:gap-10 sm:py-14">
          <div className="flex min-w-0 items-center justify-end gap-3 sm:gap-5">
            <div className="min-w-0 text-right">
              <p className="truncate font-barlow-condensed text-xl font-700 uppercase tracking-[0.5px] text-[#f0f0f0] sm:text-4xl">
                {homeTeam ?? "Home"}
              </p>
              <p className="section-label mt-1.5">Home</p>
            </div>
            <Crest name={homeTeam ?? "Home"} color={home.color} initials={home.initials} />
          </div>

          <div className="shrink-0 text-center">
            <div className="font-bebas text-6xl leading-none tracking-[3px] text-[#f0f0f0] sm:text-8xl">
              <span style={{ color: home.color }}>{score.home}</span>
              <span className="px-2 text-[#33333a] sm:px-4">-</span>
              <span style={{ color: away.color }}>{score.away}</span>
            </div>
            {phase === "live" && matchClock ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[rgba(255,59,48,0.12)] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] tabular-nums text-[#ff3b30]">
                <span className="size-1 rounded-full bg-[#ff3b30] animate-live-pulse" />
                {matchClock}
              </p>
            ) : (
              <p className="section-label mt-3">{label}</p>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-start gap-3 sm:gap-5">
            <Crest name={awayTeam ?? "Away"} color={away.color} initials={away.initials} />
            <div className="min-w-0 text-left">
              <p className="truncate font-barlow-condensed text-xl font-700 uppercase tracking-[0.5px] text-[#f0f0f0] sm:text-4xl">
                {awayTeam ?? "Away"}
              </p>
              <p className="section-label mt-1.5">Away</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

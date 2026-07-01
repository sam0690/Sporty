"use client";

import { useEffect, useState } from "react";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";
import { SignalIcon } from "./icons";

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

function Crest({
  name,
  color,
  initials,
}: {
  name: string;
  color: string;
  initials: string;
}) {
  return (
    <span
      className="grid size-14 shrink-0 place-items-center rounded-[12px] font-bebas text-xl leading-none tracking-[1px] sm:size-[4.5rem] sm:text-3xl"
      style={{
        color,
        background: `linear-gradient(160deg, ${color}33, ${color}0d)`,
        border: `1px solid ${color}5c`,
        boxShadow: `0 0 34px ${color}2e, 0 1px 0 ${color}40 inset`,
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

  // Winner emphasis (post-match) — dims the losing side subtly.
  const homeLead = score.home > score.away;
  const awayLead = score.away > score.home;

  if (loading) {
    return (
      <section className="overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12]">
        <div className="h-1 bg-[#1d1d26]" />
        <div className="skeleton h-12 border-b border-[rgba(255,255,255,0.06)]" />
        <div className="flex items-center justify-center gap-6 px-6 py-16">
          <div className="skeleton h-16 w-40 rounded-[10px]" />
          <div className="skeleton h-16 w-28 rounded-[10px]" />
          <div className="skeleton h-16 w-40 rounded-[10px]" />
        </div>
      </section>
    );
  }

  return (
    <section className="pop-in relative isolate overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.09)] bg-[#0b0b10] shadow-[0_24px_60px_-30px_rgba(0,0,0,1)]">
      {/* team-colour split accent, blended in the middle */}
      <div
        className="h-1"
        style={{
          background: `linear-gradient(90deg, ${home.color}, ${home.color} 42%, ${away.color} 58%, ${away.color})`,
        }}
      />

      {/* ambient team-colour glow orbs + subtle grain vignette */}
      <div
        aria-hidden
        className="glow-orb -left-12 top-1/2 size-64 -translate-y-1/2 opacity-[0.22]"
        style={{ background: home.color }}
      />
      <div
        aria-hidden
        className="glow-orb -right-12 top-1/2 size-64 -translate-y-1/2 opacity-[0.22]"
        style={{ background: away.color }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(80% 60% at 50% 120%, rgba(0,0,0,0.5), transparent)`,
        }}
      />
      <div aria-hidden className="grain-overlay" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] px-5 py-3 sm:px-6">
          {phase === "live" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,59,92,0.3)] bg-[rgba(255,59,92,0.1)] px-2.5 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[2px] text-[#ff3b5c]">
              <span className="size-1.5 rounded-full bg-[#ff3b5c] animate-live-pulse" />
              Live
            </span>
          ) : (
            <span className="section-label">{label}</span>
          )}

          <span className="inline-flex items-center gap-3 text-[10px] font-700 uppercase tracking-[1.5px]">
            {phase === "live" && (
              <span
                className={`inline-flex items-center gap-1.5 ${
                  socketStatus === "live" ? "text-[#00ff88]" : "text-[#ffd86b]"
                }`}
              >
                <SignalIcon className="size-3.5" />
                {socketStatus === "live"
                  ? "Connected"
                  : socketStatus === "reconnecting"
                    ? "Reconnecting"
                    : "Connecting"}
              </span>
            )}
            {agoSec != null && phase !== "pre" && (
              <span className="text-[#555560]">
                {agoSec < 2 ? "Just now" : `${agoSec}s ago`}
              </span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-9 sm:gap-10 sm:px-8 sm:py-14">
          {/* Home */}
          <div
            className={`flex min-w-0 items-center justify-end gap-3 transition-opacity sm:gap-5 ${
              phase === "post" && awayLead ? "opacity-55" : ""
            }`}
          >
            <div className="min-w-0 text-right">
              <p className="truncate font-barlow-condensed text-xl font-700 uppercase tracking-[0.5px] text-[#f0f0f0] sm:text-4xl">
                {homeTeam ?? "Home"}
              </p>
              <p className="section-label mt-1.5">
                Home{phase === "post" && homeLead ? " · Won" : ""}
              </p>
            </div>
            <Crest
              name={homeTeam ?? "Home"}
              color={home.color}
              initials={home.initials}
            />
          </div>

          {/* Score */}
          <div className="shrink-0 text-center">
            <div className="flex items-center justify-center font-bebas text-[3.25rem] leading-none tracking-[2px] sm:text-8xl">
              <span
                style={{ color: home.color }}
                className="min-w-[1.1ch] text-right tabular-nums"
              >
                {score.home}
              </span>
              <span className="px-2 text-[#3a3a42] sm:px-4">:</span>
              <span
                style={{ color: away.color }}
                className="min-w-[1.1ch] text-left tabular-nums"
              >
                {score.away}
              </span>
            </div>
            {phase === "live" && matchClock ? (
              <p className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,59,92,0.28)] bg-[rgba(255,59,92,0.12)] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] tabular-nums text-[#ff3b5c]">
                <span className="size-1 rounded-full bg-[#ff3b5c] animate-live-pulse" />
                {matchClock}
              </p>
            ) : (
              <p className="section-label mt-3.5">{label}</p>
            )}
          </div>

          {/* Away */}
          <div
            className={`flex min-w-0 items-center justify-start gap-3 transition-opacity sm:gap-5 ${
              phase === "post" && homeLead ? "opacity-55" : ""
            }`}
          >
            <Crest
              name={awayTeam ?? "Away"}
              color={away.color}
              initials={away.initials}
            />
            <div className="min-w-0 text-left">
              <p className="truncate font-barlow-condensed text-xl font-700 uppercase tracking-[0.5px] text-[#f0f0f0] sm:text-4xl">
                {awayTeam ?? "Away"}
              </p>
              <p className="section-label mt-1.5">
                Away{phase === "post" && awayLead ? " · Won" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

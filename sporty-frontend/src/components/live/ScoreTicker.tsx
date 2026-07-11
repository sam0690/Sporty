"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

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
  logoUrl,
}: {
  name: string;
  color: string;
  initials: string;
  logoUrl?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !failed;

  return (
    <span
      className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[3px] font-bebas text-xl leading-none tracking-[1px] sm:size-[4.5rem] sm:text-3xl"
      style={{
        color,
        background: `${color}14`,
        border: `1px solid ${color}40`,
      }}
      aria-label={name}
    >
      {showImage ? (
        <Image
          src={logoUrl as string}
          alt={name}
          width={72}
          height={72}
          className="h-full w-full object-contain p-1.5"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}

export function ScoreTicker({ loading = false }: { loading?: boolean }) {
  const score = useMatchStore((s) => s.score);
  const status = useMatchStore((s) => s.status);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);
  const homeTeamLogoUrl = useMatchStore((s) => s.homeTeamLogoUrl);
  const awayTeamLogoUrl = useMatchStore((s) => s.awayTeamLogoUrl);
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
      <section className="overflow-hidden card-surface">
        <div className="h-1 bg-surface-3" />
        <div className="skeleton h-12 border-b border-white/6" />
        <div className="flex items-center justify-center gap-6 px-6 py-16">
          <div className="skeleton h-16 w-40 rounded-[3px]" />
          <div className="skeleton h-16 w-28 rounded-[3px]" />
          <div className="skeleton h-16 w-40 rounded-[3px]" />
        </div>
      </section>
    );
  }

  return (
    <section className="pop-in relative overflow-hidden card-surface">
      {/* team-colour split accent, blended in the middle */}
      <div
        className="h-1"
        style={{
          background: `linear-gradient(90deg, ${home.color}, ${home.color} 42%, ${away.color} 58%, ${away.color})`,
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-3 sm:px-6">
          {phase === "live" ? (
            <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-danger/30 bg-danger/10 px-2.5 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[2px] text-danger">
              <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
              Live
            </span>
          ) : (
            <span className="section-label">{label}</span>
          )}

          <span className="inline-flex items-center gap-3 text-[10px] font-700 uppercase tracking-[1.5px]">
            {phase === "live" && (
              <span
                className={`inline-flex items-center gap-1.5 ${
                  socketStatus === "live" ? "text-success" : "text-warning"
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
              <span className="text-fg-3">
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
              <p className="truncate font-barlow-condensed text-xl font-700 uppercase tracking-[0.5px] text-fg-1 sm:text-4xl">
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
              logoUrl={homeTeamLogoUrl}
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
              <span className="px-2 text-white/20 sm:px-4">:</span>
              <span
                style={{ color: away.color }}
                className="min-w-[1.1ch] text-left tabular-nums"
              >
                {score.away}
              </span>
            </div>
            {phase === "live" && matchClock ? (
              <p className="mt-3.5 inline-flex items-center gap-1.5 rounded-[3px] border border-danger/28 bg-danger/12 px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] tabular-nums text-danger">
                <span className="size-1 rounded-full bg-danger animate-live-pulse" />
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
              logoUrl={awayTeamLogoUrl}
            />
            <div className="min-w-0 text-left">
              <p className="truncate font-barlow-condensed text-xl font-700 uppercase tracking-[0.5px] text-fg-1 sm:text-4xl">
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

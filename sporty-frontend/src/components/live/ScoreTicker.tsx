"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { useMatchStore } from "@/store/matchStore";
import { teamIdentity } from "@/lib/teamIdentity";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/utils/dateUtils";
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
      className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[3px] font-display text-xl leading-none tracking-[-0.02em] sm:size-[4.5rem] sm:text-3xl"
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

export function ScoreTicker({
  loading = false,
  footer,
}: {
  loading?: boolean;
  /** Optional band fused to the bottom of the hero card (win probability). */
  footer?: React.ReactNode;
}) {
  const score = useMatchStore((s) => s.score);
  const status = useMatchStore((s) => s.status);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);
  const homeTeamLogoUrl = useMatchStore((s) => s.homeTeamLogoUrl);
  const awayTeamLogoUrl = useMatchStore((s) => s.awayTeamLogoUrl);
  const matchDate = useMatchStore((s) => s.matchDate);
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
            <Badge tone="danger" className="gap-1.5 text-[10px] tracking-[2px]">
              <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
              Live
            </Badge>
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

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-7 sm:gap-10 sm:px-8 sm:py-10">
          {/* Home — stacked (crest over name) on mobile so long names don't
              truncate to a couple of letters; row layout from sm up. */}
          <div
            className={`flex min-w-0 flex-col-reverse items-center gap-2 text-center transition-opacity sm:flex-row sm:justify-end sm:gap-5 sm:text-right ${
              phase === "post" && awayLead ? "opacity-55" : ""
            }`}
          >
            <div className="min-w-0 max-w-full">
              <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1 sm:text-4xl">
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

          {/* Centre — score once the match exists; kickoff before it does. */}
          <div className="shrink-0 text-center">
            {phase === "pre" ? (
              <>
                <p className="font-display text-4xl leading-none tracking-[-0.02em] text-white/25 sm:text-6xl">
                  vs
                </p>
                {matchDate && formatDateTime(matchDate) ? (
                  <p className="section-label mt-3.5">
                    Kick-off · {formatDateTime(matchDate)}
                  </p>
                ) : (
                  <p className="section-label mt-3.5">{label}</p>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-center font-display text-[3.25rem] leading-none tracking-[-0.02em] sm:text-8xl">
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
                  <Badge
                    tone="danger"
                    className="mt-3.5 gap-1.5 tracking-[1.5px] tabular-nums"
                  >
                    <span className="size-1 rounded-full bg-danger animate-live-pulse" />
                    {matchClock}
                  </Badge>
                ) : (
                  <p className="section-label mt-3.5">{label}</p>
                )}
              </>
            )}
          </div>

          {/* Away */}
          <div
            className={`flex min-w-0 flex-col items-center gap-2 text-center transition-opacity sm:flex-row sm:justify-start sm:gap-5 sm:text-left ${
              phase === "post" && homeLead ? "opacity-55" : ""
            }`}
          >
            <Crest
              name={awayTeam ?? "Away"}
              color={away.color}
              initials={away.initials}
              logoUrl={awayTeamLogoUrl}
            />
            <div className="min-w-0 max-w-full">
              <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1 sm:text-4xl">
                {awayTeam ?? "Away"}
              </p>
              <p className="section-label mt-1.5">
                Away{phase === "post" && awayLead ? " · Won" : ""}
              </p>
            </div>
          </div>
        </div>

        {footer && (
          <div className="border-t border-white/8 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </section>
  );
}

/** Slim score bar fixed under the site navbar; the match page shows it once
 *  the hero has scrolled out of view, so the score/minute never leaves the
 *  screen on long live pages. */
export function MiniScoreBar({ visible }: { visible: boolean }) {
  const score = useMatchStore((s) => s.score);
  const status = useMatchStore((s) => s.status);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);
  const minute = useMatchStore((s) => s.minute);

  const { label, phase } = describeStatus(status);
  const home = teamIdentity(homeTeam ?? "Home");
  const away = teamIdentity(awayTeam ?? "Away");

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 top-16 z-40 border-b border-white/8 bg-surface-0 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      }`}
    >
      <div className="mx-auto flex h-11 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        <span className="min-w-0 flex-1 truncate text-right font-sans text-xs font-700 uppercase tracking-[0.5px] text-fg-1">
          {homeTeam ?? "Home"}
        </span>
        <span className="flex shrink-0 items-center font-display text-xl leading-none tracking-[-0.02em] tabular-nums">
          {phase === "pre" ? (
            <span className="text-white/25">vs</span>
          ) : (
            <>
              <span style={{ color: home.color }}>{score.home}</span>
              <span className="px-1.5 text-white/20">:</span>
              <span style={{ color: away.color }}>{score.away}</span>
            </>
          )}
        </span>
        <span className="min-w-0 flex-1 truncate font-sans text-xs font-700 uppercase tracking-[0.5px] text-fg-1">
          {awayTeam ?? "Away"}
        </span>
        <span className="shrink-0">
          {phase === "live" ? (
            <Badge tone="danger" className="gap-1.5 tracking-[1.5px] tabular-nums">
              <span className="size-1 rounded-full bg-danger animate-live-pulse" />
              {minute != null ? `${minute}'` : "Live"}
            </Badge>
          ) : (
            <span className="section-label">{label}</span>
          )}
        </span>
      </div>
    </div>
  );
}

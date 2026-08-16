"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { useMatchStore } from "@/store/matchStore";
import { matchIdentities } from "@/lib/teamIdentity";
import { REGULATION_MINUTES, wentToExtraTime } from "@/lib/matchPhase";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/utils/dateUtils";
import { SignalIcon } from "./icons";

type Phase = "pre" | "live" | "post";

function describeStatus(
  status: string,
  finish?: { extraTime: boolean; shootout: boolean },
): { label: string; phase: Phase } {
  const s = status.toLowerCase();
  if (s === "live" || s === "in_progress" || s === "playing") {
    return { label: "Live", phase: "live" };
  }
  if (s === "finished" || s === "ft" || s === "completed") {
    // Broadcast finish qualifiers: decided on penalties beats after extra time.
    const suffix = finish?.shootout
      ? " · Pens"
      : finish?.extraTime
        ? " · AET"
        : "";
    return { label: `Full Time${suffix}`, phase: "post" };
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
      className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[3px] bg-surface-2 font-display text-xl leading-none tracking-[-0.02em] text-fg-1 sm:size-[4.5rem] sm:text-3xl"
      style={{ border: `2px solid ${color}` }}
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

/** Ball-share meter, mirroring PredictionCard's label-row + slim-meter +
 *  values vocabulary so the two hero footer modules read as siblings. */
function PossessionMeter({
  possession,
  home,
  away,
}: {
  possession: { home_pct: number; away_pct: number } | null;
  home: { color: string };
  away: { color: string };
}) {
  if (!possession) {
    return null;
  }
  const homePct = Math.round(possession.home_pct);
  const awayPct = 100 - homePct;

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="section-label">Possession</span>
        <span className="font-sans text-[10px] font-700 uppercase tracking-[1px] text-fg-3">
          Ball share
        </span>
      </div>

      <div
        role="img"
        aria-label={`Possession: home ${homePct}%, away ${awayPct}%`}
        className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-white/6"
      >
        <div
          className="h-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${possession.home_pct}%`, background: home.color }}
        />
        <div
          className="h-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${possession.away_pct}%`, background: away.color }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <p className="font-display text-base leading-none tracking-[-0.02em] tabular-nums text-fg-1">
          <span
            className="mr-1 inline-block size-1.5 rounded-full align-middle"
            style={{ background: home.color }}
          />
          {homePct}%
        </p>
        <p className="font-display text-base leading-none tracking-[-0.02em] tabular-nums text-fg-1">
          {awayPct}%
          <span
            className="ml-1 inline-block size-1.5 rounded-full align-middle"
            style={{ background: away.color }}
          />
        </p>
      </div>
    </div>
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
  const possession = useMatchStore((s) => s.possession);
  const shootout = useMatchStore((s) => s.shootout);
  const hadExtraTime = useMatchStore((s) =>
    wentToExtraTime(s.events, s.shootout),
  );

  const { label, phase } = describeStatus(status, {
    extraTime: hadExtraTime,
    shootout: shootout != null,
  });
  const { home, away } = matchIdentities(homeTeam ?? "Home", awayTeam ?? "Away");
  const showPossession = possession != null && phase !== "pre";
  const inExtraTime =
    phase === "live" && (minute ?? 0) > REGULATION_MINUTES;

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

  // Winner emphasis (post-match) — dims the losing side subtly. A knockout
  // decided on penalties is tied on score, so the shootout breaks the tie.
  const homeLead =
    score.home > score.away ||
    (score.home === score.away && (shootout?.home ?? 0) > (shootout?.away ?? 0));
  const awayLead =
    score.away > score.home ||
    (score.home === score.away && (shootout?.away ?? 0) > (shootout?.home ?? 0));

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

      {/* Brand wash: each side's colour bleeds in from its own edge and is
          spent well before the centre line, so the card reads as this exact
          fixture without becoming a block of colour. Sits under the content
          (DOM order) and is skipped for teams we hold no colour for, since a
          grey haze is worse than none. */}
      {(home.branded || away.branded) && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 top-1"
          style={{
            background: [
              home.branded &&
                `linear-gradient(90deg, ${home.color}24, transparent 42%)`,
              away.branded &&
                `linear-gradient(270deg, ${away.color}24, transparent 42%)`,
            ]
              .filter(Boolean)
              .join(", "),
          }}
        />
      )}

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
              <span
                aria-hidden
                className="mx-auto mt-2 block h-0.5 w-10 rounded-full sm:ml-auto sm:mr-0"
                style={{ background: home.color }}
              />
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
                {/* Score stays on the neutral foreground: at this size it is
                    the page's primary text, and a 3:1 brand colour is an
                    accent, not a typeface colour. */}
                <div className="flex items-center justify-center font-display text-[3.25rem] leading-none tracking-[-0.02em] text-fg-1 sm:text-8xl">
                  <span className="min-w-[1.1ch] text-right tabular-nums">
                    {score.home}
                  </span>
                  <span className="px-2 text-white/20 sm:px-4">:</span>
                  <span className="min-w-[1.1ch] text-left tabular-nums">
                    {score.away}
                  </span>
                </div>
                {phase === "live" && matchClock ? (
                  <>
                    <Badge
                      tone="danger"
                      className="mt-3.5 gap-1.5 tracking-[1.5px] tabular-nums"
                    >
                      <span className="size-1 rounded-full bg-danger animate-live-pulse" />
                      {matchClock}
                    </Badge>
                    {inExtraTime && (
                      <p className="mt-2 font-sans text-[10px] font-700 uppercase tracking-[0.25em] text-fg-1">
                        Extra Time
                      </p>
                    )}
                  </>
                ) : (
                  <p className="section-label mt-3.5">{label}</p>
                )}
                {shootout && (
                  <p className="section-label mt-2 tabular-nums">
                    Penalties{" "}
                    <span className="text-fg-1">{shootout.home}</span>
                    <span className="px-0.5 text-white/25">–</span>
                    <span className="text-fg-1">{shootout.away}</span>
                  </p>
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
              <span
                aria-hidden
                className="mx-auto mt-2 block h-0.5 w-10 rounded-full sm:ml-0 sm:mr-auto"
                style={{ background: away.color }}
              />
              <p className="section-label mt-1.5">
                Away{phase === "post" && awayLead ? " · Won" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Footer band: model call + possession as two compact side-by-side
            modules sharing one visual vocabulary (label row, slim meter,
            values). A lone module stays narrow and centered instead of
            stretching into a full-width banner. */}
        {(footer || showPossession) && (
          <div className="border-t border-white/8 px-5 py-4 sm:px-6">
            {footer && showPossession ? (
              <div className="grid gap-5 sm:grid-cols-2 sm:gap-0">
                <div className="sm:pr-8">{footer}</div>
                <div className="border-t border-white/8 pt-5 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
                  <PossessionMeter
                    possession={possession}
                    home={home}
                    away={away}
                  />
                </div>
              </div>
            ) : (
              <div className="mx-auto w-full max-w-sm">
                {footer ?? (
                  <PossessionMeter
                    possession={possession}
                    home={home}
                    away={away}
                  />
                )}
              </div>
            )}
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
  const shootout = useMatchStore((s) => s.shootout);
  const hadExtraTime = useMatchStore((s) =>
    wentToExtraTime(s.events, s.shootout),
  );

  const { label, phase } = describeStatus(status, {
    extraTime: hadExtraTime,
    shootout: shootout != null,
  });
  const { home, away } = matchIdentities(homeTeam ?? "Home", awayTeam ?? "Away");

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
              {minute != null
                ? `${minute > REGULATION_MINUTES ? "ET " : ""}${minute}'`
                : "Live"}
            </Badge>
          ) : (
            <span className="section-label">{label}</span>
          )}
        </span>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PredictionCard } from "@/components/live/PredictionCard";
import { ScoreTicker } from "@/components/live/ScoreTicker";
import { ToastAlert } from "@/components/live/ToastAlert";
import {
  FixtureTabBar,
  FixtureTabPanels,
  useDefaultTab,
  type FixtureTab,
} from "@/components/live/FixtureTabs";
import { useMatchSocket } from "@/hooks/useMatchSocket";
import { teamIdentity } from "@/lib/teamIdentity";
import {
  fetchMatchPrediction,
  fetchMatchRatings,
  fetchMatchSnapshot,
} from "@/lib/realtimeApi";
import { useMatchStore } from "@/store/matchStore";
import type { MatchPrediction, MatchRatings } from "@/types/events";

const TAB_VALUES: FixtureTab[] = ["summary", "lineups", "stats", "predict"];
function isFixtureTab(value: string | null): value is FixtureTab {
  return value != null && (TAB_VALUES as string[]).includes(value);
}

type LiveMatchClientProps = {
  matchId: string;
  /** Deep-linked tab from the server (?tab=), so first paint matches the URL. */
  initialTab?: string;
};

export default function LiveMatchClient({
  matchId,
  initialTab,
}: LiveMatchClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<MatchPrediction | null>(null);
  const [ratings, setRatings] = useState<MatchRatings | null>(null);

  const hydrate = useMatchStore((s) => s.hydrate);
  const status = useMatchStore((s) => s.status);
  const score = useMatchStore((s) => s.score);
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);
  const minute = useMatchStore((s) => s.minute);

  // Tab selection: seeded from the server-resolved ?tab= (so first paint matches
  // a deep link with no hydration flicker), otherwise null until the user picks
  // one and a per-phase default fills in. Writes stay shallow (History API).
  const [selectedTab, setSelectedTab] = useState<FixtureTab | null>(
    isFixtureTab(initialTab ?? null) ? (initialTab as FixtureTab) : null,
  );
  const defaultTab = useDefaultTab();
  const activeTab = selectedTab ?? defaultTab;
  const changeTab = (tab: FixtureTab) => {
    setSelectedTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  };

  // The condensed score bar fades in once the hero card leaves the viewport
  // (offset by the 64px sticky navbar it slides under).
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroOffscreen, setHeroOffscreen] = useState(false);
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setHeroOffscreen(!entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px" },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      // Clear the previous match's decorative state so a slow prediction fetch
      // for the new match doesn't leave the old match's values on screen in the
      // meantime (ratings additionally gates its own fetch on this being null —
      // see the ratings effect below).
      setPrediction(null);
      setRatings(null);
      try {
        const snapshot = await fetchMatchSnapshot(matchId);
        if (!mounted) {
          return;
        }
        hydrate(snapshot);
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(
          err instanceof Error ? err.message : "Failed to load match state",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }

      // Optional extra pushed by the data feeder; absence is normal.
      try {
        const matchPrediction = await fetchMatchPrediction(matchId);
        if (mounted) {
          setPrediction(matchPrediction);
        }
      } catch {
        // Prediction is decorative — never block the live view on it.
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [hydrate, matchId]);

  useEffect(() => {
    // The WebSocket drives live updates; this periodic re-hydrate is a fallback
    // so the page self-heals if the socket drops or misses a beat. The snapshot
    // is authoritative (reads live_events + points server-side). Once finished,
    // slow down instead of stopping outright: the same match id can legitimately
    // go live again (a feeder match relaunched — see feeder_match_external_ref),
    // and with no poll at all a tab left open on the finished state would have
    // no way to ever notice. 120s keeps that self-heal cheap for the far more
    // common case of a match that really is done for good.
    const intervalMs = status === "finished" ? 120000 : 15000;
    const intervalId = window.setInterval(() => {
      fetchMatchSnapshot(matchId)
        .then((snapshot) => hydrate(snapshot))
        .catch(() => {
          // Transient failure — the next tick (or the WS) recovers.
        });
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [status, matchId, hydrate]);

  useEffect(() => {
    // Ratings only exist after the match finishes.
    if (status !== "finished" || ratings !== null) {
      return;
    }
    let mounted = true;
    fetchMatchRatings(matchId)
      .then((matchRatings) => {
        if (mounted) {
          setRatings(matchRatings);
        }
      })
      .catch(() => {
        // Ratings are decorative — never block the live view on them.
      });
    return () => {
      mounted = false;
    };
  }, [status, ratings, matchId]);

  const phase =
    status === "finished" || status === "ft" || status === "completed"
      ? "post"
      : status === "live" || status === "in_progress" || status === "playing"
        ? "live"
        : "pre";

  // A finished match emits no further updates — skip the websocket entirely so
  // we don't hold an idle, endlessly-reconnecting connection (matters most for
  // the public, high-traffic historical fixtures). Wait for the snapshot to load
  // so we decide on the real status, not the default "scheduled".
  useMatchSocket(matchId, !loading && phase !== "post");

  const home = teamIdentity(homeTeam ?? "Home");
  const away = teamIdentity(awayTeam ?? "Away");

  return (
    <div className="relative">
      <main className="relative mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <Link
          href="/fixtures"
          className="mb-4 inline-flex items-center gap-1 font-sans text-[11px] font-700 uppercase tracking-[1px] text-fg-3 transition-colors hover:text-fg-1"
        >
          <ChevronLeft className="size-3.5" />
          All Fixtures
        </Link>

        {/* Hero: scoreline + win-probability band fused into one card. The
            wrapper ref drives the condensed sticky bar once it scrolls away. */}
        <div ref={heroRef}>
          <ScoreTicker
            loading={loading}
            footer={
              prediction ? <PredictionCard prediction={prediction} /> : undefined
            }
          />
        </div>

        {/* Sticky navigator: the tab bar always, plus a condensed scoreline that
            drops in once the hero scrolls under the navbar — score + tabs stay
            reachable on long live pages without a second floating bar. */}
        <div className="sticky top-16 z-30 mt-6 border-b border-white/8 bg-surface-0/95 backdrop-blur-sm">
          <div
            aria-hidden={!heroOffscreen}
            className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out motion-reduce:transition-none ${
              heroOffscreen && !loading
                ? "max-h-12 opacity-100"
                : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex h-11 items-center justify-between gap-3 px-3">
              {/* Crest-less at this size, so a brand dot carries identity —
                  same vocabulary as the event feed's team axis. */}
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2 font-sans text-xs font-700 uppercase tracking-[0.5px] text-fg-1">
                <span className="truncate">{homeTeam ?? "Home"}</span>
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: home.color }}
                />
              </span>
              <span className="flex shrink-0 items-center font-display text-lg leading-none tracking-[-0.02em] tabular-nums text-fg-1">
                {phase === "pre" ? (
                  <span className="text-white/25">vs</span>
                ) : (
                  <>
                    <span>{score.home}</span>
                    <span className="px-1.5 text-white/20">:</span>
                    <span>{score.away}</span>
                  </>
                )}
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2 font-sans text-xs font-700 uppercase tracking-[0.5px] text-fg-1">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: away.color }}
                />
                <span className="truncate">{awayTeam ?? "Away"}</span>
              </span>
              {phase === "live" && minute != null && (
                <span className="shrink-0 rounded-[3px] bg-danger/14 px-1.5 py-0.5 font-sans text-[11px] font-700 tabular-nums text-danger-soft">
                  {minute}&apos;
                </span>
              )}
            </div>
          </div>
          <FixtureTabBar active={activeTab} onChange={changeTab} />
        </div>

        {error && (
          <p className="mt-4 rounded-[3px] border border-danger/25 bg-danger/8 px-3 py-2 text-sm text-danger-soft">
            {error}
          </p>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="space-y-4">
              <div className="skeleton h-64 rounded-[3px]" />
              <div className="skeleton h-40 rounded-[3px]" />
            </div>
          ) : (
            <FixtureTabPanels active={activeTab} ratings={ratings} matchId={matchId} />
          )}
        </div>

        <ToastAlert />
      </main>
    </div>
  );
}

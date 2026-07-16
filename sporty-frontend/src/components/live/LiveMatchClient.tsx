"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { EventFeed } from "@/components/live/EventFeed";
import { LineupsCard } from "@/components/live/LineupsCard";
import { PredictionCard } from "@/components/live/PredictionCard";
import { RatingsCard } from "@/components/live/RatingsCard";
import { MiniScoreBar, ScoreTicker } from "@/components/live/ScoreTicker";
import { LiveLeaderboard } from "@/components/live/LiveLeaderboard";
import { LineupCard } from "@/components/live/LineupCard";
import { ToastAlert } from "@/components/live/ToastAlert";
import { useMatchSocket } from "@/hooks/useMatchSocket";
import {
  fetchMatchPrediction,
  fetchMatchRatings,
  fetchMatchSnapshot,
} from "@/lib/realtimeApi";
import { useMatchStore } from "@/store/matchStore";
import type { MatchPrediction, MatchRatings } from "@/types/events";

type LiveMatchClientProps = {
  matchId: string;
};

export default function LiveMatchClient({ matchId }: LiveMatchClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<MatchPrediction | null>(null);
  const [ratings, setRatings] = useState<MatchRatings | null>(null);

  const hydrate = useMatchStore((s) => s.hydrate);
  const status = useMatchStore((s) => s.status);
  const lineup = useMatchStore((s) => s.lineup);
  const hasLineupChanges = Object.keys(lineup).length > 0;

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

  return (
    <div className="relative">
      <main className="relative mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
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
        <MiniScoreBar visible={heroOffscreen && !loading} />

        {error && (
          <p className="mt-4 rounded-[3px] border border-danger/25 bg-danger/8 px-3 py-2 text-sm text-danger-soft">
            {error}
          </p>
        )}

        {/* One shell for every phase — a wide main column and a rail. Only the
            slotting changes as the match moves pre → live → post, so the page
            never re-architects mid-watch, and DOM order matches the mobile
            reading order (main first, rail second). */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr] lg:items-start">
          <div className="min-w-0 space-y-6">
            {phase === "post" && <RatingsCard ratings={ratings} />}
            {phase === "pre" ? <LineupsCard /> : <EventFeed />}
            {phase !== "pre" && hasLineupChanges && <LineupCard />}
          </div>
          <div className="min-w-0 space-y-6">
            {phase !== "pre" && <LiveLeaderboard />}
            {phase === "pre" ? <EventFeed /> : <LineupsCard />}
          </div>
        </div>

        <ToastAlert />
      </main>
    </div>
  );
}

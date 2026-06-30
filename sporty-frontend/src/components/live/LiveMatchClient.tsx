"use client";

import { useEffect, useState } from "react";

import { EventFeed } from "@/components/live/EventFeed";
import { PointsCard } from "@/components/live/PointsCard";
import { PredictionCard } from "@/components/live/PredictionCard";
import { RatingsCard } from "@/components/live/RatingsCard";
import { ScoreTicker } from "@/components/live/ScoreTicker";
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
  const homeTeam = useMatchStore((s) => s.homeTeam);
  const awayTeam = useMatchStore((s) => s.awayTeam);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
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

      // Optional extras pushed by the data feeder; absence is normal.
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
    // is authoritative (reads live_events + points server-side). Stop once the
    // match is finished — no more changes to pull.
    if (status === "finished") {
      return;
    }
    const intervalId = window.setInterval(() => {
      fetchMatchSnapshot(matchId)
        .then((snapshot) => hydrate(snapshot))
        .catch(() => {
          // Transient failure — the next tick (or the WS) recovers.
        });
    }, 15000);
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

  useMatchSocket(matchId);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 border-b border-[rgba(255,255,255,0.08)] pb-6">
        <span className="section-label">Match Centre</span>
        <h1 className="mt-2 font-bebas text-4xl tracking-[3px] text-[#f0f0f0] sm:text-5xl">
          {homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : "Live Match"}
        </h1>
        {loading && (
          <p className="mt-2 text-sm text-[#555560]">Loading live state…</p>
        )}
        {error && <p className="mt-2 text-sm text-[#ff3b5c]">{error}</p>}
      </header>

      <ScoreTicker />

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <EventFeed />
          <LineupCard />
        </div>
        <div className="space-y-5">
          <PredictionCard prediction={prediction} />
          <PointsCard />
          <LiveLeaderboard />
          <RatingsCard ratings={ratings} />
        </div>
      </div>

      <ToastAlert />
    </main>
  );
}

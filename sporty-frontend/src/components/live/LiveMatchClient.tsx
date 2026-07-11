"use client";

import { useEffect, useState } from "react";

import { EventFeed } from "@/components/live/EventFeed";
import { LineupsCard } from "@/components/live/LineupsCard";
import { ModelMetricsCard } from "@/components/live/ModelMetricsCard";
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
  fetchModelMetrics,
} from "@/lib/realtimeApi";
import { useMatchStore } from "@/store/matchStore";
import type { MatchPrediction, MatchRatings, ModelMetrics } from "@/types/events";

type LiveMatchClientProps = {
  matchId: string;
};

export default function LiveMatchClient({ matchId }: LiveMatchClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<MatchPrediction | null>(null);
  const [ratings, setRatings] = useState<MatchRatings | null>(null);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);

  const hydrate = useMatchStore((s) => s.hydrate);
  const status = useMatchStore((s) => s.status);
  const lineup = useMatchStore((s) => s.lineup);
  const hasLineupChanges = Object.keys(lineup).length > 0;

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
      try {
        const metrics = await fetchModelMetrics();
        if (mounted) {
          setModelMetrics(metrics);
        }
      } catch {
        // The model scorecard is decorative too.
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
        <ScoreTicker loading={loading} />

        {error && (
          <p className="mt-4 rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[rgba(255,59,48,0.08)] px-3 py-2 text-sm text-danger-soft">
            {error}
          </p>
        )}

        {/* Each phase emphasises different content and fills the full width:
            pre  → prediction (who'll win) leads; events wait.
            live → events are the heartbeat (wide), board + odds in the rail.
            post → ratings/MOTM are the centrepiece, flanked by recap + board. */}
        {phase === "pre" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <LineupsCard />
            <div className="space-y-6">
              <PredictionCard prediction={prediction} />
              <ModelMetricsCard metrics={modelMetrics} />
              <EventFeed />
            </div>
          </div>
        )}

        {phase === "live" && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <div className="space-y-6">
              <EventFeed />
              {hasLineupChanges && <LineupCard />}
            </div>
            <div className="space-y-6">
              <LiveLeaderboard />
              <LineupsCard />
              <PredictionCard prediction={prediction} />
            </div>
          </div>
        )}

        {phase === "post" && (
          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.7fr_1fr]">
            <div className="order-2 space-y-6 xl:order-1">
              <EventFeed />
            </div>
            <div className="order-1 space-y-6 xl:order-2">
              <RatingsCard ratings={ratings} />
            </div>
            <div className="order-3 space-y-6">
              <LiveLeaderboard />
              <LineupsCard />
              <PredictionCard prediction={prediction} />
              <ModelMetricsCard metrics={modelMetrics} />
              {hasLineupChanges && <LineupCard />}
            </div>
          </div>
        )}

        <ToastAlert />
      </main>
    </div>
  );
}

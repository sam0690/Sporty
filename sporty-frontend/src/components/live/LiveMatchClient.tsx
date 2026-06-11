"use client";

import { useEffect, useState } from "react";

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
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-600 text-slate-900">
        Live Match {matchId}
      </h1>
      {loading && (
        <p className="text-sm text-[#555560]">Loading live state...</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ScoreTicker />
      <PredictionCard prediction={prediction} />
      <PointsCard />
      <LiveLeaderboard />
      <RatingsCard ratings={ratings} />
      <LineupCard />
      <ToastAlert />
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

import { PointsCard } from "@/components/live/PointsCard";
import { ScoreTicker } from "@/components/live/ScoreTicker";
import { LiveLeaderboard } from "@/components/live/LiveLeaderboard";
import { LineupCard } from "@/components/live/LineupCard";
import { ToastAlert } from "@/components/live/ToastAlert";
import { useMatchSocket } from "@/hooks/useMatchSocket";
import { fetchMatchSnapshot } from "@/lib/realtimeApi";
import { useMatchStore } from "@/store/matchStore";

type LiveMatchClientProps = {
  matchId: string;
};

export default function LiveMatchClient({ matchId }: LiveMatchClientProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useMatchStore((s) => s.hydrate);

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
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [hydrate, matchId]);

  useMatchSocket(matchId);

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold text-slate-900">
        Live Match {matchId}
      </h1>
      {loading && (
        <p className="text-sm text-slate-500">Loading live state...</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ScoreTicker />
      <PointsCard />
      <LiveLeaderboard />
      <LineupCard />
      <ToastAlert />
    </main>
  );
}

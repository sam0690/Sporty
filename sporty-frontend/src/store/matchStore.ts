import { create } from "zustand";

import type {
  FantasyPointsDelta,
  LineupChange,
  MatchSnapshot,
  Score,
  ScoreUpdate,
} from "@/types/events";

type MatchStoreState = {
  matchId: string | null;
  score: Score;
  playerPoints: Record<string, number>;
  lineup: Record<string, unknown>;
  status: string;
  lastUpdatedTs: number | null;
  hydrate: (snapshot: MatchSnapshot) => void;
  applyScoreUpdate: (update: ScoreUpdate) => void;
  applyPointsDelta: (delta: FantasyPointsDelta) => void;
  applyLineupChange: (change: LineupChange) => void;
};

export const useMatchStore = create<MatchStoreState>((set) => ({
  matchId: null,
  score: { home: 0, away: 0 },
  playerPoints: {},
  lineup: {},
  status: "scheduled",
  lastUpdatedTs: null,

  hydrate: (snapshot) =>
    set({
      matchId: snapshot.match_id,
      score: snapshot.score,
      playerPoints: snapshot.player_points,
      lineup: snapshot.lineups,
      status: snapshot.status,
      lastUpdatedTs: Date.now(),
    }),

  applyScoreUpdate: (update) =>
    set((state) => ({
      score: { ...state.score, home: update.home, away: update.away },
      lastUpdatedTs: Date.now(),
    })),

  applyPointsDelta: (delta) =>
    set((state) => ({
      playerPoints: {
        ...state.playerPoints,
        [delta.player_id]: delta.total_points,
      },
      lastUpdatedTs: delta.ts,
    })),

  applyLineupChange: (change) =>
    set((state) => ({
      lineup: { ...state.lineup, [change.team_id]: change },
      lastUpdatedTs: Date.now(),
    })),
}));

import { create } from "zustand";

import type {
  FantasyPointsDelta,
  LineupChange,
  MatchEvent,
  MatchSnapshot,
  PlayerInfo,
  Score,
  ScoreUpdate,
} from "@/types/events";

type MatchStoreState = {
  matchId: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  score: Score;
  players: Record<string, PlayerInfo>;
  events: MatchEvent[];
  playerPoints: Record<string, number>;
  lineup: Record<string, unknown>;
  status: string;
  lastUpdatedTs: number | null;
  hydrate: (snapshot: MatchSnapshot) => void;
  applyScoreUpdate: (update: ScoreUpdate) => void;
  applyPointsDelta: (delta: FantasyPointsDelta) => void;
  applyLineupChange: (change: LineupChange) => void;
};

// Merge live SCORE_UPDATE events into the existing timeline, normalizing the
// feeder key names to MatchEvent and skipping ids already present.
function mergeEvents(existing: MatchEvent[], update: ScoreUpdate): MatchEvent[] {
  if (!update.events?.length) {
    return existing;
  }
  const seen = new Set(existing.map((e) => e.event_id));
  const incoming = update.events
    .filter((e) => !seen.has(e.event_id))
    .map<MatchEvent>((e) => ({
      event_id: e.event_id,
      type: e.event_type,
      minute: e.minute ?? null,
      player_id: e.sporty_player_id ?? null,
      player_name: e.player_name ?? null,
      team: e.team ?? null,
    }));
  if (!incoming.length) {
    return existing;
  }
  return [...existing, ...incoming].sort(
    (a, b) => (a.minute ?? 0) - (b.minute ?? 0),
  );
}

export const useMatchStore = create<MatchStoreState>((set) => ({
  matchId: null,
  homeTeam: null,
  awayTeam: null,
  score: { home: 0, away: 0 },
  players: {},
  events: [],
  playerPoints: {},
  lineup: {},
  status: "scheduled",
  lastUpdatedTs: null,

  hydrate: (snapshot) =>
    set({
      matchId: snapshot.match_id,
      homeTeam: snapshot.home_team,
      awayTeam: snapshot.away_team,
      score: snapshot.score,
      players: snapshot.players,
      events: snapshot.events,
      playerPoints: snapshot.player_points,
      lineup: snapshot.lineups,
      status: snapshot.status,
      lastUpdatedTs: Date.now(),
    }),

  applyScoreUpdate: (update) =>
    set((state) => ({
      score: { ...state.score, home: update.home, away: update.away },
      status: update.status ?? state.status,
      events: mergeEvents(state.events, update),
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

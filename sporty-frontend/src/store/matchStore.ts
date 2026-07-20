import { create } from "zustand";

import type {
  FantasyPointsDelta,
  LineupChange,
  MatchEvent,
  MatchLineups,
  MatchSnapshot,
  PlayerInfo,
  Possession,
  Score,
  ScoreUpdate,
  Shootout,
} from "@/types/events";

const EMPTY_LINEUPS: MatchLineups = { home: [], away: [] };

export type SocketStatus = "connecting" | "live" | "reconnecting";

type MatchStoreState = {
  matchId: string | null;
  sport: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeTeamLogoUrl: string | null;
  awayTeamLogoUrl: string | null;
  score: Score;
  matchDate: string | null;
  minute: number | null;
  minuteStartedTs: number | null;
  players: Record<string, PlayerInfo>;
  events: MatchEvent[];
  playerPoints: Record<string, number>;
  startingLineups: MatchLineups;
  lineup: Record<string, unknown>;
  possession: Possession | null;
  shootout: Shootout | null;
  status: string;
  socketStatus: SocketStatus;
  lastUpdatedTs: number | null;
  hydrate: (snapshot: MatchSnapshot) => void;
  applyScoreUpdate: (update: ScoreUpdate) => void;
  applyPointsDelta: (delta: FantasyPointsDelta) => void;
  applyLineupChange: (change: LineupChange) => void;
  setSocketStatus: (status: SocketStatus) => void;
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
      related_player_id: e.related_sporty_player_id ?? null,
      related_player_name: e.related_player_name ?? null,
      related_team: e.related_team ?? null,
      extra: e.extra ?? null,
    }));
  if (!incoming.length) {
    return existing;
  }
  return [...existing, ...incoming].sort(
    (a, b) => (a.minute ?? 0) - (b.minute ?? 0),
  );
}

// Every live message carries the match_id it belongs to (feed.py/websocket.py
// scope the Redis channel per match, but that only protects the common case —
// a stray message during a matchId transition, or two feeder matches that
// briefly alias the same backend match id, should still never get merged into
// state for a different match than the one currently hydrated).
function isForCurrentMatch(state: MatchStoreState, matchId: string): boolean {
  return state.matchId === matchId;
}

export const useMatchStore = create<MatchStoreState>((set) => ({
  matchId: null,
  sport: null,
  homeTeam: null,
  awayTeam: null,
  homeTeamLogoUrl: null,
  awayTeamLogoUrl: null,
  score: { home: 0, away: 0 },
  matchDate: null,
  minute: null,
  minuteStartedTs: null,
  players: {},
  events: [],
  playerPoints: {},
  startingLineups: EMPTY_LINEUPS,
  lineup: {},
  possession: null,
  shootout: null,
  status: "scheduled",
  socketStatus: "connecting",
  lastUpdatedTs: null,

  hydrate: (snapshot) =>
    set({
      matchId: snapshot.match_id,
      sport: snapshot.sport ?? null,
      homeTeam: snapshot.home_team,
      awayTeam: snapshot.away_team,
      homeTeamLogoUrl: snapshot.home_team_logo_url,
      awayTeamLogoUrl: snapshot.away_team_logo_url,
      score: snapshot.score,
      matchDate: snapshot.match_date,
      players: snapshot.players,
      events: snapshot.events,
      playerPoints: snapshot.player_points,
      startingLineups: snapshot.lineups ?? EMPTY_LINEUPS,
      lineup: {},
      possession: snapshot.possession ?? null,
      shootout: snapshot.shootout ?? null,
      status: snapshot.status,
      minuteStartedTs: null,
      lastUpdatedTs: Date.now(),
    }),

  applyScoreUpdate: (update) =>
    set((state) => {
      if (!isForCurrentMatch(state, update.match_id)) {
        return state;
      }
      const minuteChanged =
        update.minute != null && update.minute !== state.minute;
      return {
        score: { ...state.score, home: update.home, away: update.away },
        status: update.status ?? state.status,
        minute: update.minute ?? state.minute,
        // Stamp when the minute advanced so the hero can tick MM:SS within it.
        minuteStartedTs: minuteChanged ? Date.now() : state.minuteStartedTs,
        events: mergeEvents(state.events, update),
        // Kickoff/final pushes may omit these — keep the last known values.
        possession: update.possession ?? state.possession,
        shootout: update.shootout ?? state.shootout,
        lastUpdatedTs: Date.now(),
      };
    }),

  setSocketStatus: (socketStatus) => set({ socketStatus }),

  applyPointsDelta: (delta) =>
    set((state) => {
      if (!isForCurrentMatch(state, delta.match_id)) {
        return state;
      }
      return {
        playerPoints: {
          ...state.playerPoints,
          [delta.player_id]: delta.total_points,
        },
        lastUpdatedTs: delta.ts,
      };
    }),

  applyLineupChange: (change) =>
    set((state) => {
      if (!isForCurrentMatch(state, change.match_id)) {
        return state;
      }
      return {
        lineup: { ...state.lineup, [change.team_id]: change },
        lastUpdatedTs: Date.now(),
      };
    }),
}));

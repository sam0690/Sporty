"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { EmptyState, ErrorState } from "@/components/ui";
import { LineupHeader } from "@/components/dashboard/leagues/league-lineup/components/LineupHeader";
import { LineupContainer } from "@/components/dashboard/leagues/league-lineup/components/LineupContainer";
import { LineupPitchView } from "@/components/dashboard/leagues/league-lineup/components/LineupPitchView";
import { LineupViewToggle } from "@/components/dashboard/leagues/league-lineup/components/LineupViewToggle";
import { InitialLineupBoard } from "@/components/dashboard/leagues/league-lineup/components/InitialLineupBoard";
import { LineupSkeleton } from "@/components/dashboard/leagues/league-lineup/components/LineupSkeleton";
import { SaveLineupButton } from "@/components/dashboard/leagues/league-lineup/components/SaveLineupButton";
import { GameweekContextBar } from "@/components/dashboard/leagues/GameweekContextBar";
import {
  useActiveWindow,
  useLeague,
  useUpdateLineup,
} from "@/hooks/leagues/useLeagues";
import { useSmartEditableWindowSync } from "@/hooks/leagues/useSmartActiveWindowSync";
import {
  useLeagueLineupData,
  type LineupPlayerCardModel,
} from "@/components/dashboard/leagues/league-lineup/hooks/useLeagueLineupData";
import { toastifier } from "@/lib/toastifier";
import { OptimizationService } from "@/services/OptimizationService";
import { PlayerService } from "@/services/PlayerService";
import {
  FOOTBALL_FORMATION_BOUNDS,
  getFootballFormationBucket,
  isFootballGoalkeeper,
  validateFootballFormation,
} from "@/components/dashboard/shared/formation/formationEngine";

type HeaderSport = "football" | "basketball" | "cricket" | "multisport";
const FALLBACK_DEADLINE = "2099-01-01T00:00:00.000Z";

const SPORT_LINEUP_RULES = {
  football: { starters: 11, bench: 4, total: 15, label: "Football" },
  basketball: { starters: 5, bench: 8, total: 13, label: "Basketball" },
  multisport: { starters: 9, bench: 6, total: 15, label: "Multisport" },
} as const;

const MULTISPORT_SQUAD_MIN = 13;
const MULTISPORT_SQUAD_MAX = 15;
// Canonical label Auto-Optimize's position constraints key goalkeepers under,
// regardless of the raw position string in player data (GK/GKP/etc — see
// isFootballGoalkeeper). No basketball position ever uses this label, so it's
// safe to forward even for a multisport lineup.
const GOALKEEPER_POSITION_LABEL = "GKP";
const PLAYER_STATS_CACHE_TTL_MS = 2 * 60 * 1000;

type PlayerProjectionCacheEntry = {
  projectedPoints: number;
  isKnownMissing: boolean;
  expiresAtMs: number;
};

const MULTISPORT_STARTER_REQUIREMENTS: Record<
  "football" | "basketball",
  number
> = {
  football: 5,
  basketball: 4,
};

type LineupSportType = keyof typeof SPORT_LINEUP_RULES;

function detectLineupSport(players: LineupPlayerCardModel[]): LineupSportType {
  const sportSet = new Set(players.map((player) => player.sportName));
  if (sportSet.size > 1) {
    return "multisport";
  }

  const sport = Array.from(sportSet)[0];
  if (sport === "football" || sport === "basketball") {
    return sport;
  }

  return "multisport";
}

function groupPlayersBySport(players: LineupPlayerCardModel[]) {
  return players.reduce<Record<string, LineupPlayerCardModel[]>>(
    (acc, player) => {
      if (!acc[player.sportDisplayName]) {
        acc[player.sportDisplayName] = [];
      }

      acc[player.sportDisplayName].push(player);
      return acc;
    },
    {},
  );
}

function lineupFingerprint(players: LineupPlayerCardModel[]): string {
  return [...players]
    .sort((a, b) => a.playerId.localeCompare(b.playerId))
    .map(
      (player) =>
        `${player.playerId}:${player.isStarter ? 1 : 0}:${player.isCaptain ? 1 : 0}:${player.isViceCaptain ? 1 : 0}`,
    )
    .join("|");
}

function positionBaselineProjection(position: string): number {
  const normalized = position.trim().toUpperCase();
  if (normalized.includes("GK") || normalized === "GKP") return 4.2;
  if (normalized.includes("DEF") || normalized === "D") return 4.6;
  if (normalized.includes("MID") || normalized === "M") return 5.4;
  if (
    normalized.includes("FWD") ||
    normalized.includes("ATT") ||
    normalized === "F"
  ) {
    return 5.9;
  }
  if (normalized === "PG") return 5.3;
  if (normalized === "SG") return 5.2;
  if (normalized === "SF") return 5.1;
  if (normalized === "PF") return 5.4;
  if (normalized === "C") return 5.6;
  return 4.8;
}

function parseNumericCost(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type ChipTone = "neutral" | "volt" | "gold" | "football" | "basketball";

const CHIP_TONES: Record<ChipTone, { border: string; value: string }> = {
  neutral: { border: "rgba(255,255,255,0.08)", value: "#f2f2f0" },
  volt: { border: "rgba(226,195,104,0.25)", value: "#e2c368" },
  gold: { border: "rgba(255,216,107,0.25)", value: "#ffd86b" },
  football: { border: "rgba(76,175,80,0.3)", value: "#00e07f" },
  basketball: { border: "rgba(255,107,0,0.3)", value: "#ff6b35" },
};

function StatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: ChipTone;
}) {
  const colors = CHIP_TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[3px] border bg-surface-2 px-3 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px]"
      style={{ borderColor: colors.border }}
    >
      <span className="text-fg-3">{label}</span>
      <span style={{ color: colors.value }}>{value}</span>
    </span>
  );
}

export function LeagueLineup() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";

  const {
    data: league,
    isLoading: leagueLoading,
    error: leagueError,
  } = useLeague(leagueId);
  const {
    data: activeWindow,
    isLoading: isWindowLoading,
    error: windowError,
  } = useSmartEditableWindowSync(leagueId);
  // The in-progress gameweek (the one playing now) — shown as live context only.
  const { data: liveWindow } = useActiveWindow(leagueId);
  const {
    players,
    data: lineupData,
    isLoading: lineupLoading,
    error: lineupError,
    isEmpty,
    refetch: refetchLineup,
  } = useLeagueLineupData(leagueId);
  const updateLineup = useUpdateLineup(leagueId);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "pitch">("list");
  const [editablePlayers, setEditablePlayers] = useState<
    LineupPlayerCardModel[]
  >([]);
  const playerProjectionCacheRef = useRef<
    Map<string, PlayerProjectionCacheEntry>
  >(new Map());
  const cacheWindowIdRef = useRef<string | null>(null);
  const lastServerFingerprintRef = useRef("");

  useEffect(() => {
    if (!activeWindow?.id) {
      return;
    }

    if (cacheWindowIdRef.current !== activeWindow.id) {
      playerProjectionCacheRef.current.clear();
      cacheWindowIdRef.current = activeWindow.id;
      return;
    }

    // Opportunistically evict expired entries while staying on the same window.
    const nowMs = Date.now();
    for (const [key, value] of playerProjectionCacheRef.current.entries()) {
      if (value.expiresAtMs <= nowMs) {
        playerProjectionCacheRef.current.delete(key);
      }
    }
  }, [activeWindow?.id]);

  useEffect(() => {
    const serverFingerprint = lineupFingerprint(players);
    if (serverFingerprint !== lastServerFingerprintRef.current) {
      setEditablePlayers(players);
      lastServerFingerprintRef.current = serverFingerprint;
    }
  }, [players]);

  const starters = useMemo(
    () => editablePlayers.filter((player) => player.isStarter),
    [editablePlayers],
  );

  const bench = useMemo(
    () => editablePlayers.filter((player) => !player.isStarter),
    [editablePlayers],
  );

  // Bench priority order (drag-reorderable on the pitch view), sent to the
  // backend as `bench_player_ids` — this is what FPL's own bench reordering
  // controls: which reserve gets auto-subbed in first. New bench arrivals are
  // appended at the end; departed players are pruned automatically. Re-synced
  // during render (React's "adjust state on key change" pattern, avoiding an
  // effect) whenever the bench composition actually changes.
  const benchIdsSignature = bench.map((player) => player.playerId).join("|");
  const [benchOrder, setBenchOrder] = useState<string[]>(() =>
    bench.map((player) => player.playerId),
  );
  const [lastBenchIdsSignature, setLastBenchIdsSignature] =
    useState(benchIdsSignature);
  if (benchIdsSignature !== lastBenchIdsSignature) {
    setLastBenchIdsSignature(benchIdsSignature);
    setBenchOrder((previous) => {
      const benchIds = bench.map((player) => player.playerId);
      const benchIdSet = new Set(benchIds);
      const kept = previous.filter((id) => benchIdSet.has(id));
      const missing = benchIds.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
  }

  const handleReorderBench = useCallback((draggedId: string, targetId: string) => {
    setBenchOrder((previous) => {
      const withoutDragged = previous.filter((id) => id !== draggedId);
      const targetIndex = withoutDragged.indexOf(targetId);
      if (targetIndex === -1) {
        return previous;
      }
      const next = [...withoutDragged];
      next.splice(targetIndex, 0, draggedId);
      return next;
    });
  }, []);

  const startersGroupedBySport = useMemo(
    () => groupPlayersBySport(starters),
    [starters],
  );

  const benchGroupedBySport = useMemo(
    () => groupPlayersBySport(bench),
    [bench],
  );

  const lineupSport = useMemo(() => {
    const hasManySports = (league?.sports?.length ?? 0) > 1;
    if (hasManySports) {
      return "multisport" as const;
    }

    return detectLineupSport(editablePlayers);
  }, [league?.sports, editablePlayers]);

  const lineupRules = SPORT_LINEUP_RULES[lineupSport];
  const startersCount = starters.length;
  const benchCount = bench.length;
  const targetBenchCount =
    lineupSport === "multisport"
      ? Math.max(editablePlayers.length - lineupRules.starters, 0)
      : lineupRules.bench;
  const hasExistingStartingLineup = useMemo(
    () => players.some((player) => player.isStarter),
    [players],
  );
  const isInitialSetupMode = !hasExistingStartingLineup;

  const captain = useMemo(
    () => editablePlayers.find((player) => player.isCaptain),
    [editablePlayers],
  );
  const viceCaptain = useMemo(
    () => editablePlayers.find((player) => player.isViceCaptain),
    [editablePlayers],
  );

  const lineupCountValid =
    startersCount === lineupRules.starters &&
    benchCount === lineupRules.bench &&
    editablePlayers.length === lineupRules.total;
  const leadershipValid =
    !!captain &&
    !!viceCaptain &&
    captain.playerId !== viceCaptain.playerId &&
    captain.isStarter &&
    viceCaptain.isStarter;

  // Same bounds FPL itself enforces (GK=1, DEF 3-5, MID 2-5, FWD 1-3),
  // reused live on the pitch (LineupPitchView), here at Save time, and in
  // Auto-Optimize's own constraints — one source of truth so the message a
  // user sees never drifts between those three places. Multisport's football
  // contingent is only 5 starters, so only the unambiguous "exactly 1
  // keeper" rule applies there; basketball has no reliable position data
  // (see formationEngine.ts) so it's never bounds-checked.
  const formationValidation = useMemo(():
    | { ok: true }
    | { ok: false; reason: string } => {
    if (lineupSport === "football") {
      return validateFootballFormation(starters);
    }
    if (lineupSport === "multisport") {
      const hasGoalkeeper = starters.some(
        (p) => p.sportName === "football" && isFootballGoalkeeper(p.position),
      );
      return hasGoalkeeper
        ? { ok: true }
        : {
            ok: false,
            reason:
              "Your multisport lineup needs exactly 1 football goalkeeper.",
          };
    }
    return { ok: true };
  }, [starters, lineupSport]);

  const starterCountsBySport = useMemo(
    () =>
      starters.reduce<Record<string, number>>((acc, player) => {
        acc[player.sportName] = (acc[player.sportName] ?? 0) + 1;
        return acc;
      }, {}),
    [starters],
  );

  const multisportStarterMixValid =
    lineupSport !== "multisport" ||
    ((starterCountsBySport.football ?? 0) ===
      MULTISPORT_STARTER_REQUIREMENTS.football &&
      (starterCountsBySport.basketball ?? 0) ===
        MULTISPORT_STARTER_REQUIREMENTS.basketball);

  const selectionErrorMessage = useMemo(() => {
    if (lineupSport === "multisport") {
      if (
        editablePlayers.length < MULTISPORT_SQUAD_MIN ||
        editablePlayers.length > MULTISPORT_SQUAD_MAX
      ) {
        return `You need between ${MULTISPORT_SQUAD_MIN} and ${MULTISPORT_SQUAD_MAX} squad players for Multisport.`;
      }

      if (startersCount !== lineupRules.starters) {
        return `You need exactly ${lineupRules.starters} starters for Multisport.`;
      }

      if (!multisportStarterMixValid) {
        return `Multisport starters must include ${MULTISPORT_STARTER_REQUIREMENTS.football} football and ${MULTISPORT_STARTER_REQUIREMENTS.basketball} basketball players.`;
      }
    } else {
      if (editablePlayers.length !== lineupRules.total) {
        return `You need exactly ${lineupRules.total} squad players for ${lineupRules.label}.`;
      }

      if (!lineupCountValid) {
        return `You need ${lineupRules.starters} starters and ${lineupRules.bench} bench players for ${lineupRules.label}.`;
      }
    }

    if (!formationValidation.ok) {
      return formationValidation.reason;
    }

    if (!leadershipValid) {
      return "Assign both captain and vice-captain from the starting lineup.";
    }

    return null;
  }, [
    editablePlayers.length,
    leadershipValid,
    lineupCountValid,
    lineupRules,
    lineupSport,
    startersCount,
    multisportStarterMixValid,
    formationValidation,
  ]);

  const canSave =
    (lineupSport === "multisport"
      ? editablePlayers.length >= MULTISPORT_SQUAD_MIN &&
        editablePlayers.length <= MULTISPORT_SQUAD_MAX &&
        startersCount === lineupRules.starters &&
        multisportStarterMixValid
      : lineupCountValid) &&
    leadershipValid &&
    formationValidation.ok;

  const isLineupOpen =
    Boolean(activeWindow?.id) && !activeWindow?.lineup_locked;

  const isDirty = useMemo(
    () => lineupFingerprint(players) !== lineupFingerprint(editablePlayers),
    [players, editablePlayers],
  );

  const toggleStarter = useCallback(
    (playerId: string) => {
      setEditablePlayers((current) =>
        current.map((player) => {
          if (player.playerId !== playerId) {
            return player;
          }

          if (!player.isStarter) {
            const currentStarterCount = current.filter(
              (p) => p.isStarter,
            ).length;
            if (currentStarterCount >= lineupRules.starters) {
              toastifier.error(
                `${lineupRules.label} allows only ${lineupRules.starters} starters.`,
              );
              return player;
            }

            if (lineupSport === "multisport") {
              if (
                player.sportName !== "football" &&
                player.sportName !== "basketball"
              ) {
                toastifier.error(
                  "Only football and basketball players are allowed in multisport starters.",
                );
                return player;
              }

              const currentStartersBySport = current
                .filter((p) => p.isStarter)
                .reduce<Record<string, number>>((acc, p) => {
                  acc[p.sportName] = (acc[p.sportName] ?? 0) + 1;
                  return acc;
                }, {});
              const sportLimit =
                MULTISPORT_STARTER_REQUIREMENTS[player.sportName];

              if (
                typeof sportLimit === "number" &&
                (currentStartersBySport[player.sportName] ?? 0) >= sportLimit
              ) {
                toastifier.error(
                  `Multisport allows only ${sportLimit} ${player.sportName} starters.`,
                );
                return player;
              }
            }
          }

          const nextIsStarter = !player.isStarter;
          return {
            ...player,
            isStarter: nextIsStarter,
            isCaptain: nextIsStarter ? player.isCaptain : false,
            isViceCaptain: nextIsStarter ? player.isViceCaptain : false,
          };
        }),
      );
    },
    [lineupRules, lineupSport],
  );

  // Atomic bench↔starter swap. Doing this as two sequential toggleStarter
  // calls doesn't work: the promotion half runs its "already at N starters?"
  // check before the demotion half has removed the outgoing starter, so it
  // always sees the pre-swap (full) count and rejects the promotion — leaving
  // the outgoing starter benched with no replacement. One combined update
  // sidesteps the count check entirely, since total starters never changes.
  const swapStarter = useCallback(
    (benchPlayerId: string, starterPlayerId: string) => {
      setEditablePlayers((current) =>
        current.map((player) => {
          if (player.playerId === benchPlayerId) {
            return { ...player, isStarter: true };
          }
          if (player.playerId === starterPlayerId) {
            return {
              ...player,
              isStarter: false,
              isCaptain: false,
              isViceCaptain: false,
            };
          }
          return player;
        }),
      );
    },
    [],
  );

  const setCaptain = useCallback((playerId: string) => {
    setEditablePlayers((current) =>
      current.map((player) => {
        if (!player.isStarter) {
          return player.playerId === playerId
            ? { ...player, isCaptain: false }
            : player;
        }

        const targetPlayer = current.find((item) => item.playerId === playerId);
        const shouldUnset = !!targetPlayer?.isCaptain;

        if (player.playerId !== playerId) {
          return { ...player, isCaptain: false };
        }

        return {
          ...player,
          isCaptain: !shouldUnset,
          isViceCaptain: false,
        };
      }),
    );
  }, []);

  const setViceCaptain = useCallback((playerId: string) => {
    setEditablePlayers((current) =>
      current.map((player) => {
        if (!player.isStarter) {
          return player.playerId === playerId
            ? { ...player, isViceCaptain: false }
            : player;
        }

        const targetPlayer = current.find((item) => item.playerId === playerId);
        const shouldUnset = !!targetPlayer?.isViceCaptain;

        if (player.playerId !== playerId) {
          return { ...player, isViceCaptain: false };
        }

        return {
          ...player,
          isViceCaptain: !shouldUnset,
          isCaptain: false,
        };
      }),
    );
  }, []);

  const handleSaveLineup = useCallback(() => {
    if (!isLineupOpen) {
      toastifier.error("Lineup is locked for this window.");
      return;
    }

    const starterIds = editablePlayers
      .filter((player) => player.isStarter)
      .map((player) => player.playerId);
    const selectedCaptain = editablePlayers.find((player) => player.isCaptain);
    const selectedViceCaptain = editablePlayers.find(
      (player) => player.isViceCaptain,
    );

    if (!canSave) {
      toastifier.error(
        selectionErrorMessage ??
          "Please complete lineup requirements before saving.",
      );
      return;
    }

    updateLineup.mutate({
      starting_lineup_player_ids: starterIds,
      captain_id: selectedCaptain!.playerId,
      vice_captain_id: selectedViceCaptain!.playerId,
      bench_player_ids: benchOrder,
    });
  }, [
    benchOrder,
    canSave,
    editablePlayers,
    isLineupOpen,
    selectionErrorMessage,
    updateLineup,
  ]);

  const handleOptimizeLineup = useCallback(async () => {
    if (!activeWindow?.id) {
      toastifier.error("Active window unavailable. Try again in a moment.");
      return;
    }

    if (editablePlayers.length === 0) {
      toastifier.error("No squad players available to optimize.");
      return;
    }

    setIsOptimizing(true);
    try {
      const getProjectionCacheKey = (playerId: string, windowId: string) =>
        `${playerId}:${windowId}`;

      const getHeuristicProjection = (player: LineupPlayerCardModel) =>
        positionBaselineProjection(player.position) +
        parseNumericCost(player.cost) * 0.08;

      const nowMs = Date.now();
      const sportsToFetch = Array.from(
        new Set(editablePlayers.map((player) => player.sportName)),
      );

      const statsBySport = new Map<string, Map<string, number>>();
      await Promise.all(
        sportsToFetch.map(async (sportName) => {
          try {
            const stats = await PlayerService.getPlayerStatsBulk(
              activeWindow.id,
              sportName,
            );
            statsBySport.set(
              sportName,
              new Map(
                stats.map((stat) => [
                  stat.player.id,
                  Number(stat.fantasy_points ?? 0),
                ]),
              ),
            );
          } catch {
            statsBySport.set(sportName, new Map());
          }
        }),
      );

      const projectedByPlayerId = editablePlayers.map((player) => {
        const cacheKey = getProjectionCacheKey(
          player.playerId,
          activeWindow.id,
        );
        const cached = playerProjectionCacheRef.current.get(cacheKey);

        if (cached && cached.expiresAtMs > nowMs) {
          return [player.playerId, cached.projectedPoints] as const;
        }

        if (cached) {
          playerProjectionCacheRef.current.delete(cacheKey);
        }

        const sportStats = statsBySport.get(player.sportName);
        const rawProjection = sportStats?.get(player.playerId);

        if (rawProjection !== undefined) {
          if (Number.isFinite(rawProjection) && rawProjection > 0) {
            playerProjectionCacheRef.current.set(cacheKey, {
              projectedPoints: rawProjection,
              isKnownMissing: false,
              expiresAtMs: nowMs + PLAYER_STATS_CACHE_TTL_MS,
            });
            return [player.playerId, rawProjection] as const;
          }

          const heuristicProjection = getHeuristicProjection(player);
          playerProjectionCacheRef.current.set(cacheKey, {
            projectedPoints: heuristicProjection,
            isKnownMissing: false,
            expiresAtMs: nowMs + PLAYER_STATS_CACHE_TTL_MS,
          });
          return [player.playerId, heuristicProjection] as const;
        }

        const heuristicProjection = getHeuristicProjection(player);
        playerProjectionCacheRef.current.set(cacheKey, {
          projectedPoints: heuristicProjection,
          isKnownMissing: true,
          expiresAtMs: nowMs + PLAYER_STATS_CACHE_TTL_MS,
        });
        return [player.playerId, heuristicProjection] as const;
      });

      const projectionMap = new Map(projectedByPlayerId);
      const estimatedBudget = editablePlayers.reduce(
        (sum, player) => sum + parseNumericCost(player.cost),
        0,
      );

      const leagueSlots =
        lineupSport === "multisport"
          ? (league?.lineup_slots ?? [])
          : (league?.lineup_slots ?? []).filter(
              (slot) => slot.sport?.name === lineupSport,
            );
      const positionConstraints = leagueSlots.reduce<
        Record<string, { min?: number; max?: number; exact?: number }>
      >((acc, slot) => {
        // For multisport, position labels can overlap across sports (e.g. PF),
        // so sport constraints are the primary guard and positional constraints
        // are kept only when disambiguated by single-sport context. "GKP" is
        // the one unambiguous exception (no basketball position shares it),
        // so it's still forwarded below.
        const isUnambiguousGoalkeeperSlot =
          slot.position === GOALKEEPER_POSITION_LABEL &&
          slot.sport?.name === "football";
        if (lineupSport === "multisport" && !isUnambiguousGoalkeeperSlot) {
          return acc;
        }

        acc[slot.position] = {
          min: slot.min_count,
          max: slot.max_count,
        };
        return acc;
      }, {});

      // Auto-Optimize has no built-in notion of FPL's own formation rule
      // (GK=1, DEF 3-5, MID 2-5, FWD 1-3) unless a commissioner manually
      // configured matching lineup_slots, which most leagues never do.
      // Always floor to that rule regardless of what (if anything) the
      // league configured — this is also the canonical key space every
      // football candidate's position gets normalized to below, so it
      // composes cleanly with any commissioner-configured GK/DEF/MID/FWD
      // slots (finer-grained raw labels like "CB" no longer have a matching
      // candidate to constrain, but those are rare to begin with).
      if (lineupSport === "football") {
        for (const bucket of ["GK", "DEF", "MID", "FWD"] as const) {
          const bounds = FOOTBALL_FORMATION_BOUNDS[bucket];
          const existing = positionConstraints[bucket];
          positionConstraints[bucket] = {
            min: Math.max(bounds.min, existing?.min ?? 0),
            max: existing?.max ?? bounds.max,
          };
        }
      } else if (lineupSport === "multisport") {
        // Multisport's football contingent is only 5 starters — FPL's full
        // bounds (needing at least 3+2+1=6 outfielders) are mathematically
        // infeasible there. Only the unambiguous "exactly 1 keeper" rule
        // applies.
        const existingGoalkeeperSlot =
          positionConstraints[GOALKEEPER_POSITION_LABEL];
        positionConstraints[GOALKEEPER_POSITION_LABEL] = {
          min: Math.max(1, existingGoalkeeperSlot?.min ?? 0),
          max: existingGoalkeeperSlot?.max,
        };
      }

      const sportConstraints =
        lineupSport === "multisport"
          ? {
              football: { exact: MULTISPORT_STARTER_REQUIREMENTS.football },
              basketball: { exact: MULTISPORT_STARTER_REQUIREMENTS.basketball },
            }
          : {
              [lineupSport]: { exact: lineupRules.starters },
            };

      const optimization = await OptimizationService.optimizeLineup({
        candidates: editablePlayers.map((player) => {
          const isFootballCandidate = player.sportName === "football";
          // Canonicalize football positions so the constraints above reliably
          // sum every player into the right bucket regardless of raw data
          // variance. Single-sport football normalizes to the full GK/DEF/
          // MID/FWD bucket space (matching the constraint keys just built);
          // multisport only needs the unambiguous goalkeeper label.
          const position = isFootballCandidate
            ? lineupSport === "football"
              ? getFootballFormationBucket(player.position)
              : isFootballGoalkeeper(player.position)
                ? GOALKEEPER_POSITION_LABEL
                : player.position
            : player.position;

          return {
            id: player.playerId,
            sport: player.sportName,
            position,
            club: player.realTeam,
            cost: parseNumericCost(player.cost),
            projected_points: projectionMap.get(player.playerId) ?? 0,
            is_available: true,
          };
        }),
        constraints: {
          budget: estimatedBudget,
          squad_size: lineupRules.starters,
          positions: positionConstraints,
          sports: sportConstraints,
          max_per_club: Math.max(2, Math.ceil(lineupRules.starters / 2)),
          locked_player_ids: [],
          banned_player_ids: [],
          vice_bonus_multiplier: 0,
        },
      });

      const selectedStarterIds = new Set(optimization.selected_player_ids);

      setEditablePlayers((current) =>
        current.map((player) => ({
          ...player,
          isStarter: selectedStarterIds.has(player.playerId),
          isCaptain: player.playerId === optimization.captain_player_id,
          isViceCaptain:
            player.playerId === optimization.vice_captain_player_id,
        })),
      );

      toastifier.success(
        "Optimized lineup applied. Review and save when ready.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Optimization failed";
      toastifier.error(message);
    } finally {
      setIsOptimizing(false);
    }
  }, [
    activeWindow,
    editablePlayers,
    league,
    lineupRules.starters,
    lineupSport,
  ]);

  const selectedLeague = useMemo(() => {
    if (!league) return null;

    const sportName = league.sports?.[0]?.sport.name;
    const hasManySports = (league.sports?.length ?? 0) > 1;

    const sport = hasManySports
      ? "multisport"
      : sportName === "football" ||
          sportName === "basketball" ||
          sportName === "cricket"
        ? sportName
        : "multisport";

    return {
      leagueId: league.id,
      leagueName: league.name,
      teamName: lineupData?.team_name,
      sport,
      currentWeek: activeWindow?.number || 1,
      totalWeeks: activeWindow?.total_number || 16,
      deadline: activeWindow?.lineup_deadline_at || FALLBACK_DEADLINE,
    };
  }, [league, activeWindow, lineupData?.team_name]);

  if (leagueLoading || lineupLoading || isWindowLoading || !selectedLeague) {
    return <LineupSkeleton />;
  }

  if (leagueError || lineupError || windowError) {
    const message =
      leagueError?.message || lineupError?.message || windowError?.message;

    return (
      <section className="space-y-6">
        <ErrorState message={message} onRetry={refetchLineup} />
      </section>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        title="You don't have any players in this league yet"
        description="Join a league or make transfers to add players"
        actions={[
          {
            label: "Go to Transfers",
            href: `/leagues/${leagueId}/transfers`,
            variant: "primary",
          },
        ]}
      />
    );
  }

  return (
    <section className="space-y-6">
      <LineupHeader
        leagueName={selectedLeague.leagueName}
        teamName={selectedLeague.teamName}
        sport={selectedLeague.sport as HeaderSport}
        currentWeek={selectedLeague.currentWeek}
        totalWeeks={selectedLeague.totalWeeks}
        deadline={selectedLeague.deadline}
      />

      <GameweekContextBar
        leagueId={leagueId}
        editableWindow={activeWindow}
        activeWindow={liveWindow}
        deadlineField="lineup_deadline_at"
      />

      <LineupViewToggle value={viewMode} onChange={setViewMode} />

      <div className="card-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleOptimizeLineup}
            disabled={isOptimizing || updateLineup.isPending}
            className="rounded-[3px] border border-accent/35 bg-accent/10 px-4 py-1.5 font-sans text-xs font-700 uppercase tracking-[1.5px] text-accent transition-colors hover:bg-accent/18 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isOptimizing ? "Optimizing…" : "Auto-Optimize Lineup"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatChip label="Total" value={editablePlayers.length} />
          <StatChip
            label="Starters"
            value={`${startersCount} / ${lineupRules.starters}`}
            tone="volt"
          />
          <StatChip label="Bench" value={`${benchCount} / ${targetBenchCount}`} />
          <StatChip label="Captain" value={captain?.name || "N/A"} tone="gold" />
          <StatChip
            label="Vice"
            value={viceCaptain?.name || "N/A"}
            tone="neutral"
          />
          {lineupSport === "multisport" ? (
            <>
              <StatChip
                label="Football"
                value={`${starterCountsBySport.football ?? 0} / ${MULTISPORT_STARTER_REQUIREMENTS.football}`}
                tone="football"
              />
              <StatChip
                label="Basketball"
                value={`${starterCountsBySport.basketball ?? 0} / ${MULTISPORT_STARTER_REQUIREMENTS.basketball}`}
                tone="basketball"
              />
            </>
          ) : null}
        </div>
        {selectionErrorMessage ? (
          <p className="mt-3 rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[rgba(255,59,48,0.08)] px-3 py-2 text-sm text-danger-soft">
            {selectionErrorMessage}
          </p>
        ) : null}
      </div>

      {isInitialSetupMode ? (
        <InitialLineupBoard
          sportLabel={lineupRules.label}
          sportType={lineupSport}
          requiredStarters={lineupRules.starters}
          requiredBench={targetBenchCount}
          selectedStarterCount={startersCount}
        />
      ) : null}

      {viewMode === "list" ? (
        <LineupContainer
          startersGroupedBySport={startersGroupedBySport}
          benchGroupedBySport={benchGroupedBySport}
          onToggleStarter={toggleStarter}
          onSetCaptain={setCaptain}
          onSetViceCaptain={setViceCaptain}
          starterLimitReached={startersCount >= lineupRules.starters}
          disabled={updateLineup.isPending || !isLineupOpen}
        />
      ) : (
        <LineupPitchView
          allPlayers={editablePlayers}
          benchOrder={benchOrder}
          onReorderBench={handleReorderBench}
          onToggleStarter={toggleStarter}
          onSwapStarter={swapStarter}
          onSetCaptain={setCaptain}
          onSetViceCaptain={setViceCaptain}
          starterLimitReached={startersCount >= lineupRules.starters}
          disabled={updateLineup.isPending || !isLineupOpen}
        />
      )}

      <SaveLineupButton
        onSave={handleSaveLineup}
        isLoading={updateLineup.isPending || isOptimizing}
        isDirty={isDirty}
        disabled={!canSave || isOptimizing || !isLineupOpen}
      />
    </section>
  );
}

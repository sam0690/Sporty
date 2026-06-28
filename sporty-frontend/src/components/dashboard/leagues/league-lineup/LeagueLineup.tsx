"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { EmptyState } from "@/components/dashboard/leagues/league-lineup/components/EmptyState";
import { ErrorState } from "@/components/dashboard/leagues/league-lineup/components/ErrorState";
import { LineupHeader } from "@/components/dashboard/leagues/league-lineup/components/LineupHeader";
import { LineupContainer } from "@/components/dashboard/leagues/league-lineup/components/LineupContainer";
import { LineupPitchView } from "@/components/dashboard/leagues/league-lineup/components/LineupPitchView";
import { LineupViewToggle } from "@/components/dashboard/leagues/league-lineup/components/LineupViewToggle";
import { InitialLineupBoard } from "@/components/dashboard/leagues/league-lineup/components/InitialLineupBoard";
import { LineupSkeleton } from "@/components/dashboard/leagues/league-lineup/components/LineupSkeleton";
import { SaveLineupButton } from "@/components/dashboard/leagues/league-lineup/components/SaveLineupButton";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { useLeague, useUpdateLineup } from "@/hooks/leagues/useLeagues";
import { useSmartActiveWindowSync } from "@/hooks/leagues/useSmartActiveWindowSync";
import {
  useLeagueLineupData,
  type LineupPlayerCardModel,
} from "@/components/dashboard/leagues/league-lineup/hooks/useLeagueLineupData";
import { useLineupPositions } from "@/components/dashboard/leagues/league-lineup/hooks/useLineupPositions";
import { toastifier } from "@/lib/toastifier";
import { OptimizationService } from "@/services/OptimizationService";
import { PlayerService } from "@/services/PlayerService";
import { isFootballGoalkeeper } from "@/components/dashboard/shared/formation/formationEngine";

type HeaderSport = "football" | "basketball" | "cricket" | "multisport";
const FALLBACK_DEADLINE = "2099-01-01T00:00:00.000Z";

const SPORT_LINEUP_RULES = {
  football: { starters: 11, bench: 4, total: 15, label: "Football" },
  basketball: { starters: 5, bench: 10, total: 15, label: "Basketball" },
  multisport: { starters: 9, bench: 6, total: 15, label: "Multisport" },
} as const;

const MULTISPORT_SQUAD_MIN = 13;
const MULTISPORT_SQUAD_MAX = 15;
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

export function LeagueLineup() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";
  const { data: me } = useMe();

  const {
    data: league,
    isLoading: leagueLoading,
    error: leagueError,
  } = useLeague(leagueId);
  const {
    data: activeWindow,
    isLoading: isWindowLoading,
    error: windowError,
  } = useSmartActiveWindowSync(leagueId);
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

  const startersGroupedBySport = useMemo(
    () => groupPlayersBySport(starters),
    [starters],
  );

  const benchGroupedBySport = useMemo(
    () => groupPlayersBySport(bench),
    [bench],
  );

  const lineupPlayerIds = useMemo(
    () => editablePlayers.map((player) => player.playerId),
    [editablePlayers],
  );

  const {
    positions: pitchPositions,
    setPosition: setPitchPosition,
    clearPosition: clearPitchPosition,
    resetPositions: resetPitchPositions,
  } = useLineupPositions({
    leagueId,
    teamId: lineupData?.fantasy_team_id ?? null,
    validPlayerIds: lineupPlayerIds,
  });

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

  const hasGoalkeeper = useMemo(() => {
    // We only enforce GK for football or multisport (which includes football)
    if (lineupSport !== "football" && lineupSport !== "multisport") {
      return true;
    }

    return starters.some((p) => {
      // Must be a football player to be a football GK
      if (p.sportName !== "football") return false;
      return isFootballGoalkeeper(p.position);
    });
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

    if (!hasGoalkeeper) {
      return "Your starting lineup must include at least one Football Goalkeeper.";
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
    hasGoalkeeper,
  ]);

  const canSave =
    (lineupSport === "multisport"
      ? editablePlayers.length >= MULTISPORT_SQUAD_MIN &&
        editablePlayers.length <= MULTISPORT_SQUAD_MAX &&
        startersCount === lineupRules.starters &&
        multisportStarterMixValid
      : lineupCountValid) &&
    leadershipValid &&
    hasGoalkeeper;

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
    });
  }, [
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
        // are kept only when disambiguated by single-sport context.
        if (lineupSport === "multisport") {
          return acc;
        }

        acc[slot.position] = {
          min: slot.min_count,
          max: slot.max_count,
        };
        return acc;
      }, {});

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
        candidates: editablePlayers.map((player) => ({
          id: player.playerId,
          sport: player.sportName,
          position: player.position,
          club: player.realTeam,
          cost: parseNumericCost(player.cost),
          projected_points: projectionMap.get(player.playerId) ?? 0,
          is_available: true,
        })),
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

  const isCommissioner = league?.owner?.id === me?.id;

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
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-[#f0f0f0]">
        <NavigationTabs
          activeTab="lineup"
          leagueId={leagueId}
          isCommissioner={isCommissioner}
        />
        <ErrorState message={message} onRetry={refetchLineup} />
      </section>
    );
  }

  if (isEmpty) {
    return <EmptyState leagueId={leagueId} />;
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-[#f0f0f0]">
      <p className="text-sm text-[#555560]">
        Manager: {me?.username || "Sporty User"}
      </p>

      <NavigationTabs
        activeTab="lineup"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <LineupHeader
        leagueName={selectedLeague.leagueName}
        teamName={selectedLeague.teamName}
        sport={selectedLeague.sport as HeaderSport}
        currentWeek={selectedLeague.currentWeek}
        totalWeeks={selectedLeague.totalWeeks}
        deadline={selectedLeague.deadline}
      />

      <LineupViewToggle value={viewMode} onChange={setViewMode} />

      <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleOptimizeLineup}
            disabled={isOptimizing || updateLineup.isPending}
            className="rounded-[3px] border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] px-4 py-1.5 text-xs font-600 text-[#e8fb25] transition hover:bg-[rgba(232,251,37,0.1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isOptimizing ? "Optimizing..." : "Auto-Optimize Lineup"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-[#f0f0f0]/65">
          <span className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1">
            Total Players: {editablePlayers.length}
          </span>
          <span className="rounded-[3px] border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
            Starting Lineup: {startersCount} / {lineupRules.starters}
          </span>
          <span className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1 text-[#f0f0f0]/75">
            Bench: {benchCount} / {targetBenchCount}
          </span>
          <span className="rounded-[3px] border border-yellow-400/20 bg-yellow-500/10 px-3 py-1 text-yellow-100">
            Captain: {captain?.name || "N/A"}
          </span>
          <span className="rounded-[3px] border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-blue-100">
            Vice-Captain: {viceCaptain?.name || "N/A"}
          </span>
          {lineupSport === "multisport" ? (
            <>
              <span className="rounded-[3px] border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                Football Starters: {starterCountsBySport.football ?? 0} /{" "}
                {MULTISPORT_STARTER_REQUIREMENTS.football}
              </span>
              <span className="rounded-[3px] border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-orange-100">
                Basketball Starters: {starterCountsBySport.basketball ?? 0} /{" "}
                {MULTISPORT_STARTER_REQUIREMENTS.basketball}
              </span>
            </>
          ) : null}
        </div>
        {selectionErrorMessage ? (
          <p className="mt-3 rounded-[3px] border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
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
          positions={pitchPositions}
          onSetPosition={setPitchPosition}
          onClearPosition={clearPitchPosition}
          onResetPositions={resetPitchPositions}
          onToggleStarter={toggleStarter}
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

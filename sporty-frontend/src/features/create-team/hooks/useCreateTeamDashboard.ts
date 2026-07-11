"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMe } from "@/hooks/auth/useMe";
import type { MarketPlayer } from "../components/PlayerCard";
import {
  useLeague,
  useActiveWindow,
  useEditableWindow,
  useBuildTeam,
  useDiscardTeamPlayer,
  useDraftTurn,
  useMakeDraftPick,
  useMyTeam,
} from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";
import { usePlayers } from "@/hooks/players/usePlayers";
import { usePlayerFilters } from "@/hooks/players/usePlayerFilters";
import { CreateTeamSchema, type CreateTeamValues } from "@/lib/validations";
import { toastifier } from "@/lib/toastifier";
import { LeagueService } from "@/services/LeagueService";

const sportIconByName: Record<string, string> = {
  football: "⚽",
  basketball: "🏀",
};

export const MULTISPORT_MIN_BY_SPORT = {
  football: 8,
  basketball: 7,
} as const;

const EMPTY_POSITION_MINIMUMS: Record<string, number> = {};

const PLAYER_PAGE_SIZE = 20;

function normalizeLeagueSport(
  sports: Array<{ sport: { name: string } }> | undefined,
): "football" | "basketball" | "multisport" {
  if (!sports || sports.length === 0) {
    return "multisport";
  }
  if (sports.length > 1) {
    return "multisport";
  }

  const name = sports[0]?.sport?.name;
  if (name === "football" || name === "basketball") {
    return name;
  }
  return "multisport";
}

export type CreateTeamViewModel = ReturnType<typeof useCreateTeamDashboard>;

export function useCreateTeamDashboard() {
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { username, data: me } = useMe();
  const leagueId = params?.id || searchParams.get("leagueId") || "";

  const { data: league, isLoading: leagueLoading } = useLeague(leagueId || "");
  const { data: myTeam } = useMyTeam(leagueId || "");

  // Only relevant once a team exists — tells the user whether their squad
  // missed the in-progress gameweek's lineup deadline (see
  // GameweekEntryNotice for why that happens and what it means).
  const hasTeam = !!myTeam;
  const { data: activeWindow } = useActiveWindow(leagueId || "", {
    enabled: !!leagueId && hasTeam,
  });
  const { data: editableWindow } = useEditableWindow(leagueId || "", {
    enabled: !!leagueId && hasTeam,
  });

  const leagueSport = normalizeLeagueSport(league?.sports);
  const isMultiSportLeague = leagueSport === "multisport";
  const { isDraftMode: isDraftLeague } = useLeagueCompetitionMode(league);
  const [playersPage, setPlayersPage] = useState(1);
  const initialSportName =
    !isDraftLeague && !isMultiSportLeague
      ? league?.sports?.[0]?.sport.name
      : undefined;
  const {
    searchQuery,
    setSearchQuery,
    selectedPosition,
    setSelectedPosition,
    selectedSport,
    setSelectedSport,
    minCostInput,
    setMinCostInput,
    maxCostInput,
    setMaxCostInput,
    filters: playerFilters,
  } = usePlayerFilters(initialSportName);

  const { data: playersData, isLoading: playersLoading } = usePlayers({
    league_id: leagueId || undefined,
    page: playersPage,
    page_size: PLAYER_PAGE_SIZE,
    ...playerFilters,
    ...(isDraftLeague || isMultiSportLeague
      ? {}
      : { sport_name: initialSportName }),
  });

  const buildTeamMutation = useBuildTeam();
  const makeDraftPickMutation = useMakeDraftPick(leagueId || "");
  const discardTeamPlayerMutation = useDiscardTeamPlayer(leagueId || "");
  const { data: draftTurn } = useDraftTurn(
    leagueId || "",
    !!leagueId && isDraftLeague && league?.status === "drafting",
  );

  // Keep the draft pool in sync with the live draft. `useDraftTurn` polls every
  // few seconds; `next_pick_number` increments on every pick (by anyone), so a
  // change means a player was just taken. Refetch the players pool then — the
  // backend already excludes rostered players by league_id — so selected
  // players drop out automatically, no manual refresh needed.
  const lastPickNumberRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isDraftLeague || league?.status !== "drafting") {
      lastPickNumberRef.current = null;
      return;
    }
    const pickNumber = draftTurn?.next_pick_number;
    if (pickNumber == null) return;

    // First reading just establishes a baseline — don't refetch on mount.
    if (lastPickNumberRef.current === null) {
      lastPickNumberRef.current = pickNumber;
      return;
    }
    if (pickNumber !== lastPickNumberRef.current) {
      lastPickNumberRef.current = pickNumber;
      queryClient.invalidateQueries({ queryKey: ["players"] });
    }
  }, [
    draftTurn?.next_pick_number,
    isDraftLeague,
    league?.status,
    queryClient,
  ]);

  const [step, setStep] = useState(1);
  const [selectedPlayers, setSelectedPlayers] = useState<MarketPlayer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pickHistory, setPickHistory] = useState<string[]>([]);
  const [isAutoPicking, setIsAutoPicking] = useState(false);

  const {
    control,
    setValue,
    trigger,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTeamValues>({
    resolver: zodResolver(CreateTeamSchema),
    defaultValues: {
      player_ids: [],
      team_name: "",
    },
    mode: "onSubmit",
  });

  const teamName = useWatch({ control, name: "team_name" }) ?? "";

  const marketPlayers: MarketPlayer[] = useMemo(() => {
    if (!playersData?.items) return [];
    return playersData.items.map((p) => ({
      id: p.id,
      name: p.display_name,
      sport: p.sport.name as "football" | "basketball",
      icon: sportIconByName[p.sport.name] ?? "🏅",
      position: p.position,
      realTeam: p.real_team,
      photoUrl: p.photo_url,
      realTeamLogoUrl: p.real_team_logo_url,
      price: Number(p.current_cost),
      projected: 0,
    }));
  }, [playersData]);

  const draftedPlayers: MarketPlayer[] = useMemo(() => {
    const rows = myTeam?.team_players ?? myTeam?.players ?? [];
    return rows.map((row) => {
      const player = row.player;
      return {
        id: player.id,
        name: player.name,
        sport: player.sport.name as "football" | "basketball",
        icon: sportIconByName[player.sport.name] ?? "🏅",
        position: player.position,
        realTeam: player.real_team,
        photoUrl: player.photo_url,
        realTeamLogoUrl: player.real_team_logo_url,
        price: Number(player.cost),
        projected: 0,
      };
    });
  }, [myTeam]);

  const selectedPlayerIds = useMemo(
    () => selectedPlayers.map((player) => player.id),
    [selectedPlayers],
  );

  const playersPageSize = playersData?.page_size ?? PLAYER_PAGE_SIZE;
  const playersTotal = playersData?.total ?? 0;
  const playersCurrentPage = playersData?.page ?? playersPage;
  const playersTotalPages = Math.max(
    1,
    Math.ceil(playersTotal / Math.max(playersPageSize, 1)),
  );
  const isPlayersPageLoading =
    playersLoading ||
    (playersData?.page !== undefined && playersData.page !== playersPage);

  useEffect(() => {
    setValue("player_ids", selectedPlayerIds, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [selectedPlayerIds, setValue]);

  const selectedCountsBySport = useMemo(
    () =>
      selectedPlayers.reduce<Record<string, number>>((acc, player) => {
        acc[player.sport] = (acc[player.sport] ?? 0) + 1;
        return acc;
      }, {}),
    [selectedPlayers],
  );

  const totalCost = useMemo(
    () => selectedPlayers.reduce((sum, player) => sum + player.price, 0),
    [selectedPlayers],
  );

  const rawBudget = Number(league?.budget_per_team ?? 103);
  const budget = Number.isFinite(rawBudget) ? rawBudget : 103;

  const SQUAD_SIZES: Record<string, number> = {
    football: 15,
    basketball: 13,
    multisport: 15,
  };
  const requiredPlayers = SQUAD_SIZES[leagueSport];
  const minPlayersRequired = requiredPlayers;
  const maxPlayersAllowed = requiredPlayers;
  const remainingBudget = budget - totalCost;
  const budgetUsed = Math.max(0, budget - remainingBudget);
  const budgetProgress =
    budget > 0 ? Math.min(100, (budgetUsed / budget) * 100) : 0;

  const draftedCountsBySport = useMemo(
    () =>
      draftedPlayers.reduce<Record<string, number>>((acc, player) => {
        acc[player.sport] = (acc[player.sport] ?? 0) + 1;
        return acc;
      }, {}),
    [draftedPlayers],
  );

  // Live squad-composition validation — enforced rules only: squad size,
  // budget, and (multisport) per-sport minimums. Budget mode validates the
  // in-progress selection; draft mode validates the already-drafted roster.
  const activeCounts = isDraftLeague
    ? draftedCountsBySport
    : selectedCountsBySport;
  const activeSquadSize = isDraftLeague
    ? draftedPlayers.length
    : selectedPlayers.length;
  const activeRemainingBudget = isDraftLeague
    ? Number(myTeam?.current_budget ?? budget)
    : remainingBudget;

  // Canonical rules from the backend (app/league/sportConfigs.py) — read,
  // never hardcoded, so the frontend can't drift from what's enforced there.
  const activePlayers = isDraftLeague ? draftedPlayers : selectedPlayers;
  const positionMinimums = league?.position_minimums ?? EMPTY_POSITION_MINIMUMS;
  const maxPerClub = league?.max_per_club;

  const activePositionCounts = useMemo(
    () =>
      activePlayers.reduce<Record<string, number>>((acc, player) => {
        acc[player.position] = (acc[player.position] ?? 0) + 1;
        return acc;
      }, {}),
    [activePlayers],
  );

  // Per-club tally for a max-per-club warning list — only clubs at or past
  // the cap are worth surfacing, not every club in the squad.
  const clubCounts = useMemo(() => {
    if (!maxPerClub) {
      return [];
    }
    const counts = activePlayers.reduce<Record<string, number>>((acc, player) => {
      const club = player.realTeam || "Unknown club";
      acc[club] = (acc[club] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .filter(([, count]) => count >= maxPerClub)
      .map(([club, count]) => ({ club, count, max: maxPerClub }));
  }, [activePlayers, maxPerClub]);

  const squadValidation: Array<{
    key: string;
    label: string;
    detail: string;
    satisfied: boolean;
  }> = [
    {
      key: "size",
      label: "Squad size",
      detail: `${activeSquadSize}/${requiredPlayers}`,
      satisfied: activeSquadSize === requiredPlayers,
    },
    // Draft leagues have no cost cap on picks, so budget isn't a real
    // constraint there — only show it for budget-mode squad building.
    ...(isDraftLeague
      ? []
      : [
          {
            key: "budget",
            label: "Within budget",
            detail: `$${activeRemainingBudget.toFixed(1)}M left`,
            satisfied: activeRemainingBudget >= 0,
          },
        ]),
    ...(isMultiSportLeague
      ? [
          {
            key: "football",
            label: "Football minimum",
            detail: `${activeCounts.football ?? 0}/${MULTISPORT_MIN_BY_SPORT.football}`,
            satisfied:
              (activeCounts.football ?? 0) >= MULTISPORT_MIN_BY_SPORT.football,
          },
          {
            key: "basketball",
            label: "Basketball minimum",
            detail: `${activeCounts.basketball ?? 0}/${MULTISPORT_MIN_BY_SPORT.basketball}`,
            satisfied:
              (activeCounts.basketball ?? 0) >=
              MULTISPORT_MIN_BY_SPORT.basketball,
          },
        ]
      : []),
    ...Object.entries(positionMinimums).map(([position, required]) => ({
      key: `position-${position}`,
      label: `${position} minimum`,
      detail: `${activePositionCounts[position] ?? 0}/${required}`,
      satisfied: (activePositionCounts[position] ?? 0) >= required,
    })),
  ];
  const isSquadValid = squadValidation.every((rule) => rule.satisfied);

  // In a snake draft every manager finishes with a full squad at the same last
  // pick, so "roster full" and "draft complete" coincide — either is a safe
  // signal to surface the finish CTA.
  const isRosterComplete = draftedPlayers.length >= requiredPlayers;
  const isDraftComplete = Boolean(draftTurn?.is_draft_complete);

  const handleGoToLineup = useCallback(() => {
    if (!leagueId) return;
    router.push(`/leagues/${leagueId}/lineup`);
  }, [leagueId, router]);

  const handleSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setPlayersPage(1);
    },
    [setSearchQuery],
  );

  const handlePositionChange = useCallback(
    (position: string) => {
      setSelectedPosition(position);
      setPlayersPage(1);
    },
    [setSelectedPosition],
  );

  const handleSportChange = useCallback(
    (sport: string) => {
      setSelectedSport(sport);
      setPlayersPage(1);
    },
    [setSelectedSport],
  );

  const handleMinCostChange = useCallback(
    (value: string) => {
      setMinCostInput(value);
      setPlayersPage(1);
    },
    [setMinCostInput],
  );

  const handleMaxCostChange = useCallback(
    (value: string) => {
      setMaxCostInput(value);
      setPlayersPage(1);
    },
    [setMaxCostInput],
  );

  const isMyDraftTurn =
    isDraftLeague &&
    league?.status === "drafting" &&
    !!draftTurn?.current_turn_user_id &&
    !!me?.id &&
    String(draftTurn.current_turn_user_id) === String(me.id);

  const handleAddPlayer = (player: MarketPlayer) => {
    setError(null);

    if (!isMultiSportLeague && player.sport !== leagueSport) {
      setError(`Only ${leagueSport} players are allowed in this league.`);
      return;
    }

    if (selectedPlayerIds.includes(player.id)) {
      setError("Cannot add the same player twice.");
      return;
    }
    if (selectedPlayers.length >= maxPlayersAllowed) {
      const message =
        minPlayersRequired === maxPlayersAllowed
          ? `You must select exactly ${requiredPlayers} players.`
          : `You can select up to ${maxPlayersAllowed} players.`;
      setError(message);
      return;
    }
    setSelectedPlayers((prev) => [...prev, player]);
    setPickHistory((prev) => [...prev, player.id]);
  };

  const handleRemovePlayer = (playerId: string) => {
    setError(null);
    setSelectedPlayers((prev) =>
      prev.filter((player) => player.id !== playerId),
    );
  };

  const handleDraftPick = async (player: MarketPlayer) => {
    if (!leagueId) return;
    setError(null);
    if (!isMyDraftTurn) {
      setError("It is not your turn to pick yet.");
      return;
    }
    try {
      await makeDraftPickMutation.mutateAsync(String(player.id));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Unable to submit draft pick",
      );
    }
  };

  const handleUndoLastPick = () => {
    setError(null);
    setPickHistory((prev) => {
      if (prev.length === 0) {
        return prev;
      }

      const lastPickedId = prev[prev.length - 1];
      setSelectedPlayers((current) =>
        current.filter((player) => player.id !== lastPickedId),
      );

      return prev.slice(0, -1);
    });
  };

  const handleAutoPickSquad = useCallback(async () => {
    setError(null);
    setIsAutoPicking(true);

    try {
      if (!leagueId) {
        return;
      }

      const result = await LeagueService.autoPickTeam(leagueId, {
        lockedPlayerIds: selectedPlayers.map((player) => player.id),
      });

      const SQUAD_SIZES: Record<string, number> = {
        football: 15,
        basketball: 13,
        multisport: 15,
      };
      const expected = SQUAD_SIZES[leagueSport];

      if (result.players.length !== expected) {
        toastifier.error(
          `Expected ${expected} players, received ${result.players.length}`,
        );
        return;
      }

      const nextSelection: MarketPlayer[] = result.players.map((player) => ({
        id: player.id,
        name: player.name,
        sport: player.sport_type as "football" | "basketball",
        icon: sportIconByName[player.sport_type] ?? "🏅",
        position: player.position,
        price: Number(player.cost),
        projected: 0,
      }));

      setSelectedPlayers(nextSelection);
      setPickHistory(nextSelection.map((player) => player.id));

      toastifier.success(
        "Auto-picked a squad suggestion. Review and click Save to confirm.",
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to auto-pick squad";
      setError(message);
      toastifier.error(message);
    } finally {
      setIsAutoPicking(false);
    }
  }, [leagueId, leagueSport, selectedPlayers]);

  const handlePreviousPlayersPage = () => {
    setPlayersPage((current) => Math.max(1, current - 1));
  };

  const handleNextPlayersPage = () => {
    if (!playersData?.has_next) {
      return;
    }

    setPlayersPage((current) => current + 1);
  };

  const handleDiscardTeamPlayer = async (playerId: string) => {
    if (!leagueId) return;
    setError(null);
    try {
      const result = await discardTeamPlayerMutation.mutateAsync(playerId);
      toastifier.success(
        `Discarded player. Refunded $${result.refund.toFixed(2)} after $${result.penalty_applied.toFixed(2)} penalty.`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to discard player";
      setError(message);
      toastifier.error(message);
    }
  };

  const handleNextStep = async () => {
    setError(null);

    const selectionValid = await trigger("player_ids");
    if (!selectionValid) {
      setError("Select at least one player.");
      return;
    }

    if (selectedPlayers.length !== requiredPlayers) {
      const message = `You need exactly ${requiredPlayers} players for a ${leagueSport} league.`;
      setError(message);
      toastifier.info(message);
      return;
    }

    if (isMultiSportLeague) {
      const footballCount = selectedCountsBySport.football ?? 0;
      const basketballCount = selectedCountsBySport.basketball ?? 0;

      if (
        footballCount < MULTISPORT_MIN_BY_SPORT.football ||
        basketballCount < MULTISPORT_MIN_BY_SPORT.basketball
      ) {
        const message = `Multisport squads must include at least ${MULTISPORT_MIN_BY_SPORT.football} football and ${MULTISPORT_MIN_BY_SPORT.basketball} basketball players.`;
        setError(message);
        toastifier.info(message);
        return;
      }
    }

    setStep(2);
  };

  const handleCreateTeam = handleSubmit(async (values) => {
    if (!leagueId) return;

    try {
      if (
        selectedPlayers.length < minPlayersRequired ||
        selectedPlayers.length > maxPlayersAllowed
      ) {
        const message =
          minPlayersRequired === maxPlayersAllowed
            ? `Complete your team first: select ${requiredPlayers} players.`
            : `Complete your team first: select between ${minPlayersRequired} and ${maxPlayersAllowed} players.`;
        setError(message);
        toastifier.info(message);
        setStep(1);
        return;
      }

      if (isMultiSportLeague) {
        const footballCount = selectedCountsBySport.football ?? 0;
        const basketballCount = selectedCountsBySport.basketball ?? 0;
        if (
          footballCount < MULTISPORT_MIN_BY_SPORT.football ||
          basketballCount < MULTISPORT_MIN_BY_SPORT.basketball
        ) {
          const message = `Multisport squads must include at least ${MULTISPORT_MIN_BY_SPORT.football} football and ${MULTISPORT_MIN_BY_SPORT.basketball} basketball players.`;
          setError(message);
          toastifier.info(message);
          setStep(1);
          return;
        }
      }

      await buildTeamMutation.mutateAsync({
        id: leagueId,
        payload: {
          team_name: values.team_name.trim(),
          player_ids: values.player_ids.map((id) => id.toString()),
        },
      });

      router.push(`/leagues/${leagueId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create team");
      setStep(2);
    }
  });

  return {
    // basic context
    username,
    router,
    league,
    leagueLoading,
    myTeam,
    leagueSport,
    isMultiSportLeague,
    isDraftLeague,
    activeWindow,
    editableWindow,
    playersPage,
    setPlayersPage,
    // players
    playersData,
    playersLoading,
    playersPageSize,
    playersTotal,
    playersCurrentPage,
    playersTotalPages,
    isPlayersPageLoading,
    marketPlayers,
    draftedPlayers,
    // form
    control,
    setValue,
    trigger,
    handleSubmit,
    errors,
    teamName,
    // selection state
    step,
    setStep,
    selectedPlayers,
    setSelectedPlayers,
    selectedPlayerIds,
    searchQuery,
    selectedPosition,
    selectedSport,
    minCostInput,
    maxCostInput,
    handleSearchQueryChange,
    handlePositionChange,
    handleSportChange,
    handleMinCostChange,
    handleMaxCostChange,
    error,
    setError,
    pickHistory,
    setPickHistory,
    selectedCountsBySport,
    totalCost,
    budget,
    requiredPlayers,
    minPlayersRequired,
    maxPlayersAllowed,
    remainingBudget,
    budgetUsed,
    budgetProgress,
    squadValidation,
    clubCounts,
    isSquadValid,
    isRosterComplete,
    isDraftComplete,
    isAutoPicking,
    isMyDraftTurn,
    // handlers
    handleAddPlayer,
    handleRemovePlayer,
    handleDraftPick,
    handleAutoPickSquad,
    handleUndoLastPick,
    handlePreviousPlayersPage,
    handleNextPlayersPage,
    handleDiscardTeamPlayer,
    handleNextStep,
    handleCreateTeam,
    handleGoToLineup,
    // mutations (exposed for view-level controls)
    buildTeamMutation,
    makeDraftPickMutation,
    discardTeamPlayerMutation,
    draftTurn,
  } as const;
}

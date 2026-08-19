"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  useMyTeam,
} from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";
import {
  buildSquadValidation,
  clubWarnings,
  countBy,
  explainUnmetRule,
  normalizeLeagueSport,
  SQUAD_SIZES,
} from "@/lib/squad/squadRules";
import { CreateTeamSchema, type CreateTeamValues } from "@/lib/validations";
import { toastifier } from "@/lib/toastifier";
import { LeagueService } from "@/services/LeagueService";
import { toMarketPlayer, usePlayerMarket } from "./usePlayerMarket";

export type CreateTeamViewModel = ReturnType<typeof useCreateTeamDashboard>;

/**
 * Budget-mode squad building: pick-N-players-under-budget selection, the
 * two-step form (squad → team name), auto-pick, and setup-phase discards.
 * Draft leagues use useDraftRoom instead — the two modes share only the
 * player market (usePlayerMarket) and the squad rules (lib/squad).
 */
export function useCreateTeamDashboard() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { username } = useMe();
  const leagueId = params?.id ?? "";

  const { data: league } = useLeague(leagueId);
  const { data: myTeam } = useMyTeam(leagueId);

  // Only relevant once a team exists — tells the user whether their squad
  // missed the in-progress gameweek's lineup deadline (see
  // GameweekEntryNotice for why that happens and what it means).
  const hasTeam = !!myTeam;
  const { data: activeWindow } = useActiveWindow(leagueId, {
    enabled: !!leagueId && hasTeam,
  });
  const { data: editableWindow } = useEditableWindow(leagueId, {
    enabled: !!leagueId && hasTeam,
  });

  const leagueSport = normalizeLeagueSport(league?.sports);
  const isMultiSportLeague = leagueSport === "multisport";
  const { isDraftMode: isDraftLeague } = useLeagueCompetitionMode(league);

  const market = usePlayerMarket(
    leagueId,
    isMultiSportLeague ? undefined : league?.sports?.[0]?.sport.name,
  );

  const buildTeamMutation = useBuildTeam();
  const discardTeamPlayerMutation = useDiscardTeamPlayer(leagueId);

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

  const draftedPlayers: MarketPlayer[] = useMemo(() => {
    const rows = myTeam?.team_players ?? myTeam?.players ?? [];
    return rows.map((row) =>
      toMarketPlayer({
        id: row.player.id,
        display_name: row.player.name,
        sport: row.player.sport,
        position: row.player.position,
        real_team: row.player.real_team,
        photo_url: row.player.photo_url,
        real_team_logo_url: row.player.real_team_logo_url,
        current_cost: row.player.cost,
      }),
    );
  }, [myTeam]);

  const selectedPlayerIds = useMemo(
    () => selectedPlayers.map((player) => player.id),
    [selectedPlayers],
  );

  useEffect(() => {
    setValue("player_ids", selectedPlayerIds, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [selectedPlayerIds, setValue]);

  const selectedCountsBySport = useMemo(
    () => countBy(selectedPlayers, "sport"),
    [selectedPlayers],
  );

  const totalCost = useMemo(
    () => selectedPlayers.reduce((sum, player) => sum + player.price, 0),
    [selectedPlayers],
  );

  const rawBudget = Number(league?.budget_per_team ?? 100);
  const budget = Number.isFinite(rawBudget) ? rawBudget : 100;

  const requiredPlayers = SQUAD_SIZES[leagueSport];
  const minPlayersRequired = requiredPlayers;
  const maxPlayersAllowed = requiredPlayers;
  const remainingBudget = budget - totalCost;
  const budgetUsed = Math.max(0, budget - remainingBudget);
  const budgetProgress =
    budget > 0 ? Math.min(100, (budgetUsed / budget) * 100) : 0;

  // Live squad-composition validation of the in-progress selection —
  // canonical rules from the backend (app/league/sportConfigs.py) arrive on
  // the league payload; only squad sizes are mirrored client-side.
  const squadValidation = useMemo(
    () =>
      buildSquadValidation({
        players: selectedPlayers,
        leagueSport,
        includeBudgetRule: true,
        remainingBudget,
        positionMinimums: league?.position_minimums ?? {},
        maxPerClub: league?.max_per_club,
      }),
    [
      selectedPlayers,
      leagueSport,
      remainingBudget,
      league?.position_minimums,
      league?.max_per_club,
    ],
  );
  const unmetRule = squadValidation.find((rule) => !rule.satisfied) ?? null;
  const isSquadValid = !unmetRule;
  const clubCounts = useMemo(
    () => clubWarnings(selectedPlayers, league?.max_per_club),
    [selectedPlayers, league?.max_per_club],
  );

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

      const expected = SQUAD_SIZES[leagueSport];
      if (result.players.length !== expected) {
        toastifier.error(
          `Expected ${expected} players, received ${result.players.length}`,
        );
        return;
      }

      const nextSelection: MarketPlayer[] = result.players.map((player) =>
        toMarketPlayer({
          id: player.id,
          display_name: player.name,
          sport: { name: player.sport_type },
          position: player.position,
          real_team: player.real_team ?? "",
          current_cost: player.cost,
        }),
      );

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

  // The checklist IS the gate — one rule set for what's shown and what's
  // enforced, so a displayed ✗ can never be submittable (the backend rejects
  // the same squad in build_initial_team).
  const validateSelectionOrExplain = (): string | null =>
    explainUnmetRule(squadValidation);

  const handleNextStep = async () => {
    setError(null);

    const selectionValid = await trigger("player_ids");
    if (!selectionValid) {
      setError("Select at least one player.");
      return;
    }

    const problem = validateSelectionOrExplain();
    if (problem) {
      setError(problem);
      toastifier.info(problem);
      return;
    }

    setStep(2);
  };

  const handleCreateTeam = handleSubmit(async (values) => {
    if (!leagueId) return;

    try {
      const problem = validateSelectionOrExplain();
      if (problem) {
        setError(problem);
        toastifier.info(problem);
        setStep(1);
        return;
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
    username,
    router,
    league,
    myTeam,
    leagueSport,
    isMultiSportLeague,
    isDraftLeague,
    activeWindow,
    editableWindow,
    draftedPlayers,
    // form
    setValue,
    errors,
    teamName,
    // selection state
    step,
    setStep,
    selectedPlayers,
    selectedPlayerIds,
    error,
    pickHistory,
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
    isAutoPicking,
    // handlers
    handleAddPlayer,
    handleRemovePlayer,
    handleAutoPickSquad,
    handleUndoLastPick,
    handleDiscardTeamPlayer,
    handleNextStep,
    handleCreateTeam,
    // mutations (exposed for view-level controls)
    buildTeamMutation,
    discardTeamPlayerMutation,
    // player market (filters, pagination, mapped players)
    ...market,
  } as const;
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import {
  useActiveWindow,
  useCancelTransfers,
  useConfirmTransfers,
  useLeague,
  useMyTeam,
  useStageIn,
  useStageOut,
  useUserTransfers,
} from "@/hooks/leagues/useLeagues";
import { useSmartEditableWindowSync } from "@/hooks/leagues/useSmartActiveWindowSync";
import { useTransferPoolPlayers } from "@/hooks/players/usePlayers";
import { usePlayerFilters } from "@/hooks/players/usePlayerFilters";
import { toastifier } from "@/lib/toastifier";
import { isApiError } from "@/utils/api-Error";
import type { OwnedPlayer } from "../components/CurrentRoster";
import type { Sport } from "../components/FilterBar";
import type { TBudgetOverageDetail } from "@/types";

const TRANSFER_POOL_PAGE_SIZE = 20;
const EMPTY_POSITION_MINIMUMS: Record<string, number> = {};

const toSport = (value?: string): Exclude<Sport, "All"> => {
  if (value === "football" || value === "basketball" || value === "cricket") {
    return value;
  }
  return "football";
};

export function useTransfersDashboard(leagueIdOverride?: string) {
  const searchParams = useSearchParams();
  const leagueId = leagueIdOverride || searchParams.get("leagueId") || "";
  const { username } = useMe();

  const { data: league, isLoading: leagueLoading } = useLeague(leagueId);
  const { data: myTeam, isLoading: teamLoading } = useMyTeam(leagueId);
  const {
    data: userTransferGroups,
    isLoading: userTransfersLoading,
    error: userTransfersError,
  } = useUserTransfers();
  const activeWindowQuery = useSmartEditableWindowSync(leagueId);
  const activeWindow = activeWindowQuery.data;
  const windowLoading = activeWindowQuery.isLoading;
  // The in-progress gameweek (playing now) — shown as live context only.
  const liveWindow = useActiveWindow(leagueId).data;
  const [playersPage, setPlayersPage] = useState(1);
  const initialSportName = league?.sports?.length === 1 ? toSport(league.sports[0]?.sport?.name) : undefined;
  const {
    searchQuery,
    setSearchQuery,
    selectedSport,
    setSelectedSport,
    selectedPosition,
    setSelectedPosition,
    minCostInput,
    setMinCostInput,
    maxCostInput,
    setMaxCostInput,
    filters: playerFilters,
    clearFilters,
  } = usePlayerFilters(initialSportName);

  const leagueSports = useMemo(
    () =>
      Array.from(
        new Set(
          (league?.sports ?? [])
            .map((entry) => toSport(entry?.sport?.name))
            .filter(
              (sport): sport is Exclude<Sport, "All"> =>
                sport === "football" || sport === "basketball",
            ),
        ),
      ),
    [league?.sports],
  );

  const playersQuery = useTransferPoolPlayers(
    leagueId,
    league?.sports,
    playerFilters,
    playersPage,
    TRANSFER_POOL_PAGE_SIZE,
  );
  const playersData = playersQuery.data;
  const playersLoading = playersQuery.isLoading;
  const playersFetching = playersQuery.isFetching;
  const stageOutMutation = useStageOut(leagueId);
  const stageInMutation = useStageIn(leagueId);
  const confirmTransfersMutation = useConfirmTransfers(leagueId);
  const cancelTransfersMutation = useCancelTransfers(leagueId);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedOutPlayer, setSelectedOutPlayer] = useState<OwnedPlayer | null>(null);
  const [stagedOutPlayers, setStagedOutPlayers] = useState<OwnedPlayer[]>([]);
  const [stagedInPlayers, setStagedInPlayers] = useState<OwnedPlayer[]>([]);

  const [toastState, setToastState] = useState<{
    status: "success" | "error" | null;
    message: string;
    token: number;
  }>({
    status: null,
    message: "",
    token: 0,
  });

  const [sessionBudget, setSessionBudget] = useState<number | null>(null);
  const [transfersRemaining, setTransfersRemaining] = useState<number | null>(null);
  const [budgetOverage, setBudgetOverage] = useState<TBudgetOverageDetail | null>(null);
  const isMultiSportLeague = leagueSports.length > 1;
  // Mirror the backend transfer gate (validate_transfer_window_for_transfer):
  // a window containing "now" is not enough — transfers close at
  // transfer_deadline_at (2h before window end) and can be force-locked.
  // Without the deadline check the UI shows transfers open in the final 2h of
  // a window, then the API rejects them with 409.
  const isTransfersOpen =
    Boolean(activeWindow?.id) &&
    !activeWindow?.transfers_locked &&
    !!activeWindow?.transfer_deadline_at &&
    // eslint-disable-next-line react-hooks/purity -- wall-clock deadline check; the confirm modal re-validates with a live countdown
    Date.now() <= new Date(activeWindow.transfer_deadline_at).getTime();

  const ownedPlayers: OwnedPlayer[] = useMemo(() => {
    const rows = myTeam?.team_players ?? myTeam?.players ?? [];
    return rows.map((p) => ({
      id: p.player.id,
      name: p.player.name,
      sport: toSport(p.player.sport?.name),
      position: p.player.position,
      price: Number(p.player.cost),
      avgPoints: 0,
      form: 0,
      realTeam: p.player.real_team,
      photoUrl: p.player.photo_url,
      realTeamLogoUrl: p.player.real_team_logo_url,
    }));
  }, [myTeam]);

  const availablePlayers = useMemo(() => {
    if (!playersData?.items) return [];
    const ownedIds = new Set(ownedPlayers.map((p) => p.id.toString()));
    const stagedInIds = new Set(stagedInPlayers.map((p) => p.id.toString()));
    return playersData.items
      .filter((p) => !ownedIds.has(p.id) && !stagedInIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.display_name || p.name || "Unknown",
        sport: toSport(p.sport.name),
        position: p.position,
        price: Number(p.current_cost ?? p.cost ?? 0),
        avgPoints: p.projected_points ?? 0,
        form: 0,
        realTeam: p.real_team,
        photoUrl: p.photo_url,
        realTeamLogoUrl: p.real_team_logo_url,
      }));
  }, [playersData, ownedPlayers, stagedInPlayers]);

  const playersPageSize = playersData?.page_size ?? TRANSFER_POOL_PAGE_SIZE;
  const playersTotal = playersData?.total ?? 0;
  const playersCurrentPage = playersData?.page ?? playersPage;
  const playersTotalPages = Math.max(1, Math.ceil(playersTotal / Math.max(playersPageSize, 1)));
  const isPlayersPageLoading = playersLoading || playersFetching;

  const stagedOutIds = useMemo(() => new Set(stagedOutPlayers.map((player) => player.id.toString())), [stagedOutPlayers]);

  const visibleOwnedPlayers = useMemo(
    () => ownedPlayers.filter((player) => !stagedOutIds.has(player.id.toString())),
    [ownedPlayers, stagedOutIds],
  );

  // Projected final roster if all staged transfers were confirmed right now —
  // used to give live feedback on position minimums / max-per-club before
  // confirming, same canonical rules the backend enforces (app/league/sportConfigs.py).
  const projectedRoster = useMemo(
    () => [...visibleOwnedPlayers, ...stagedInPlayers],
    [visibleOwnedPlayers, stagedInPlayers],
  );

  const positionMinimums = league?.position_minimums ?? EMPTY_POSITION_MINIMUMS;
  const maxPerClub = league?.max_per_club;

  const positionValidation = useMemo(() => {
    const counts = projectedRoster.reduce<Record<string, number>>((acc, player) => {
      acc[player.position] = (acc[player.position] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(positionMinimums).map(([position, required]) => ({
      key: `position-${position}`,
      label: `${position} minimum`,
      detail: `${counts[position] ?? 0}/${required}`,
      satisfied: (counts[position] ?? 0) >= required,
    }));
  }, [projectedRoster, positionMinimums]);

  const clubCounts = useMemo(() => {
    if (!maxPerClub) {
      return [];
    }
    const counts = projectedRoster.reduce<Record<string, number>>((acc, player) => {
      const club = player.realTeam || "Unknown club";
      acc[club] = (acc[club] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts)
      .filter(([, count]) => count >= maxPerClub)
      .map(([club, count]) => ({ club, count, max: maxPerClub }));
  }, [projectedRoster, maxPerClub]);

  const availableSportsForFilter = useMemo(
    () =>
      leagueSports.length > 0
        ? leagueSports
        : Array.from(new Set(availablePlayers.map((player) => player.sport).filter((sport) => sport !== "cricket"))),
    [leagueSports, availablePlayers],
  );

  const positionOptionsBySport = useMemo(() => {
    const bySport: Partial<Record<Sport, string[]>> = { All: ["All"] };

    for (const sport of availableSportsForFilter) {
      const sportPositions = Array.from(
        new Set(availablePlayers.filter((player) => player.sport === sport).map((player) => player.position).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b));

      bySport[sport] = ["All", ...sportPositions];
    }

    const allPositions = Array.from(new Set(availablePlayers.map((player) => player.position).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    bySport.All = ["All", ...allPositions];

    return bySport;
  }, [availablePlayers, availableSportsForFilter]);

  const handlePreviousPlayersPage = useCallback(() => {
    setPlayersPage((current) => Math.max(1, current - 1));
  }, []);

  const handleNextPlayersPage = useCallback(() => {
    if (!playersData?.has_next) return;
    setPlayersPage((current) => current + 1);
  }, [playersData?.has_next]);

  const handleSportChange = useCallback((sport: Sport) => {
    setSelectedSport(sport);
    setSelectedPosition("All");
    setPlayersPage(1);
  }, [setSelectedPosition, setSelectedSport]);

  const handlePositionChange = useCallback((position: string) => {
    setSelectedPosition(position);
    setPlayersPage(1);
  }, [setSelectedPosition]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPlayersPage(1);
  }, [setSearchQuery]);

  const handleMinCostChange = useCallback((value: string) => {
    setMinCostInput(value);
    setPlayersPage(1);
  }, [setMinCostInput]);

  const handleMaxCostChange = useCallback((value: string) => {
    setMaxCostInput(value);
    setPlayersPage(1);
  }, [setMaxCostInput]);

  const handleAddPlayer = useCallback(async (id: string) => {
    if (!isMultiSportLeague && stagedOutPlayers.length === 0) {
      toastifier.error("Stage out at least one player first");
      return;
    }

    if (!isMultiSportLeague && stagedInPlayers.length >= stagedOutPlayers.length) {
      toastifier.error("You have already staged enough players in");
      return;
    }

    const player = availablePlayers.find((item) => item.id === id);
    if (!player) return;

    if (!leagueId || !activeWindow?.id || !isTransfersOpen) {
      toastifier.error("Transfers are closed for this window");
      return;
    }

    try {
      const stagedIn = await stageInMutation.mutateAsync({ league_id: leagueId, gameweek_id: activeWindow.id, player_id: player.id.toString() });

      setSessionBudget(stagedIn.currentBudget);
      setTransfersRemaining(stagedIn.transfersRemaining);
      setStagedInPlayers((prev) => [...prev, player]);

      setToastState({ status: "success", message: `${player.name} staged in`, token: Date.now() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transfer failed";
      setToastState({ status: "error", message, token: Date.now() });
    }
  }, [availablePlayers, stagedInPlayers, stagedOutPlayers, leagueId, activeWindow, isTransfersOpen, isMultiSportLeague, stageInMutation]);

  const handleStageOut = useCallback(async (id: string) => {
    if (!isTransfersOpen) {
      toastifier.error("Transfers are closed for this window");
      return;
    }

    const player = ownedPlayers.find((item) => item.id === id);
    if (!player) return;

    if (stagedOutPlayers.some((p) => p.id === id)) {
      toastifier.error("This player is already staged out");
      return;
    }

    if (selectedOutPlayer?.id === id) {
      try {
        await cancelTransfersMutation.mutateAsync();
      } catch {
        // handled by toast state below
      }
      setSelectedOutPlayer(null);
      setStagedOutPlayers([]);
      setStagedInPlayers([]);
      setSessionBudget(null);
      setTransfersRemaining(null);
      setShowConfirmModal(false);
      return;
    }

    try {
      if (!activeWindow?.id) {
        setToastState({ status: "error", message: "No active transfer window", token: Date.now() });
        return;
      }
      const staged = await stageOutMutation.mutateAsync({ league_id: leagueId, gameweek_id: activeWindow.id, player_id: id });
      setSelectedOutPlayer(player);
      setStagedOutPlayers((prev) => [...prev, player]);
      setSessionBudget(staged.currentBudget);
      setTransfersRemaining(staged.transfersAllowed - staged.transfersUsed);
      setToastState({ status: "success", message: `${player.name} staged out`, token: Date.now() });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to stage out";
      setToastState({ status: "error", message, token: Date.now() });
    }
  }, [isTransfersOpen, ownedPlayers, stagedOutPlayers, selectedOutPlayer, cancelTransfersMutation, stageOutMutation, leagueId, activeWindow]);

  const confirmAllTransfers = useCallback(async (payWithPoints = false) => {
    if (!leagueId || !activeWindow?.id) return;

    if (stagedOutPlayers.length === 0 && stagedInPlayers.length === 0) {
      toastifier.error("Stage at least one transfer action before confirming");
      return;
    }

    if (!isMultiSportLeague && stagedOutPlayers.length !== stagedInPlayers.length) {
      toastifier.error("Pending in/out counts must match before confirming");
      return;
    }

    try {
      const confirmed = await confirmTransfersMutation.mutateAsync({
        league_id: leagueId,
        gameweek_id: activeWindow.id,
        pay_shortfall_with_points: payWithPoints,
      });

      setSessionBudget(confirmed.newBudget);
      setTransfersRemaining(confirmed.transfersRemaining);
      setSelectedOutPlayer(null);
      setStagedOutPlayers([]);
      setStagedInPlayers([]);
      setSessionBudget(null);
      setTransfersRemaining(null);
      setShowConfirmModal(false);
      setBudgetOverage(null);

      setToastState({
        status: "success",
        message: confirmed.pointsCharged
          ? `All staged transfers confirmed — ${confirmed.pointsCharged} points charged for budget overage`
          : "All staged transfers confirmed",
        token: Date.now(),
      });
    } catch (err: unknown) {
      // Budget-overage confirmations get a structured 409 (see
      // app/services/transfer_service.py::confirm_transfers) instead of a
      // plain message — open a confirm dialog offering to pay with points
      // rather than just toasting the generic failure.
      const detail = isApiError(err)
        ? (err.details as TBudgetOverageDetail | undefined)
        : undefined;

      if (detail?.error === "insufficient_budget" && !payWithPoints) {
        setBudgetOverage(detail);
        return;
      }

      setBudgetOverage(null);
      const message = err instanceof Error ? err.message : "Failed to confirm transfers";
      setToastState({ status: "error", message, token: Date.now() });
    }
  }, [leagueId, activeWindow, stagedOutPlayers, stagedInPlayers, isMultiSportLeague, confirmTransfersMutation]);

  const confirmPayWithPoints = useCallback(() => {
    void confirmAllTransfers(true);
  }, [confirmAllTransfers]);

  const dismissBudgetOverage = useCallback(() => {
    setBudgetOverage(null);
  }, []);

  const clearAllFilters = useCallback(() => {
    clearFilters();
    setPlayersPage(1);
  }, [clearFilters]);

  const isLoading = leagueLoading || teamLoading || playersLoading || windowLoading;
  const normalizedBudget = Number(myTeam?.current_budget ?? 0);
  const liveBudget = Number.isFinite(normalizedBudget) ? normalizedBudget : 0;
  const budget = sessionBudget ?? liveBudget;

  return {
    username,
    leagueId,
    league,
    userTransferGroups,
    userTransfersLoading,
    userTransfersError,
    activeWindow,
    liveWindow,
    playersCurrentPage,
    playersTotalPages,
    playersTotal,
    isPlayersPageLoading,
    isLoading,
    budget,
    transfersRemaining,
    stagedOutPlayers,
    stagedInPlayers,
    selectedOutPlayer,
    visibleOwnedPlayers,
    availablePlayers,
    availableSportsForFilter,
    positionOptionsBySport,
    isTransfersOpen,
    isMultiSportLeague,
    positionValidation,
    clubCounts,
    selectedSport,
    selectedPosition,
    searchQuery,
    minCostInput,
    maxCostInput,
    showConfirmModal,
    setShowConfirmModal,
    budgetOverage,
    confirmPayWithPoints,
    dismissBudgetOverage,
    handlePreviousPlayersPage,
    handleNextPlayersPage,
    handleSearchChange,
    handleSportChange,
    handlePositionChange,
    handleMinCostChange,
    handleMaxCostChange,
    handleAddPlayer,
    handleStageOut,
    confirmAllTransfers,
    clearAllFilters,
    cancelTransfersMutation,
    confirmTransfersMutation,
    toastState,
    setToastState,
  };
}

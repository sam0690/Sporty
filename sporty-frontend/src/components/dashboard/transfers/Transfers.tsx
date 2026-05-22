"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useMe } from "@/hooks/auth/useMe";
import {
  CurrentRoster,
  type OwnedPlayer,
} from "@/components/dashboard/transfers/components/CurrentRoster";
import {
  FilterBar,
  type Sport,
} from "@/components/dashboard/transfers/components/FilterBar";
import { PlayerCard } from "@/components/dashboard/transfers/components/PlayerCard";
import { SearchBar } from "@/components/dashboard/transfers/components/SearchBar";
import { TransferConfirmation } from "@/components/dashboard/transfers/components/TransferConfirmation";
import { TransfersHeader } from "@/components/dashboard/transfers/components/TransfersHeader";
import { TransferSuccess } from "@/components/dashboard/transfers/components/TransferSuccess";
import { UserTransferHistoryCarousel } from "./components/UserTransferHistoryCarousel";
import { EmptyTransfers } from "@/components/ui/empty-states";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";
import {
  useCancelTransfers,
  useConfirmTransfers,
  useLeague,
  useMyTeam,
  useStageIn,
  useStageOut,
  useUserTransfers,
} from "@/hooks/leagues/useLeagues";
import { useSmartActiveWindowSync } from "@/hooks/leagues/useSmartActiveWindowSync";
import { useTransferPoolPlayers } from "@/hooks/players/usePlayers";
import { toastifier } from "@/lib/toastifier";

const TRANSFER_POOL_PAGE_SIZE = 20;

const toSport = (value?: string): Exclude<Sport, "All"> => {
  if (value === "football" || value === "basketball" || value === "cricket") {
    return value;
  }
  return "football";
};

export function Transfers() {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get("leagueId") || "";
  const { username } = useMe();

  const { data: league, isLoading: leagueLoading } = useLeague(leagueId);
  const { data: myTeam, isLoading: teamLoading } = useMyTeam(leagueId);
  const {
    data: userTransferGroups,
    isLoading: userTransfersLoading,
    error: userTransfersError,
  } = useUserTransfers();
  const activeWindowQuery = useSmartActiveWindowSync(leagueId);
  const activeWindow = activeWindowQuery.data;
  const windowLoading = activeWindowQuery.isLoading;
  const [playersPage, setPlayersPage] = useState(1);
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

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResetToken, setSearchResetToken] = useState(0);
  const [selectedSport, setSelectedSport] = useState<Sport>("All");
  const [selectedPosition, setSelectedPosition] = useState("All");

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedOutPlayer, setSelectedOutPlayer] =
    useState<OwnedPlayer | null>(null);
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
  const [transfersRemaining, setTransfersRemaining] = useState<number | null>(
    null,
  );
  const isMultiSportLeague = leagueSports.length > 1;
  const isTransfersOpen =
    Boolean(activeWindow?.id) && !activeWindow?.transfers_locked;

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
        avgPoints: 0,
        form: 0,
      }));
  }, [playersData, ownedPlayers, stagedInPlayers]);

  const playersPageSize = playersData?.page_size ?? TRANSFER_POOL_PAGE_SIZE;
  const playersTotal = playersData?.total ?? 0;
  const playersCurrentPage = playersData?.page ?? playersPage;
  const playersTotalPages = Math.max(
    1,
    Math.ceil(playersTotal / Math.max(playersPageSize, 1)),
  );
  const isPlayersPageLoading = playersLoading || playersFetching;

  const stagedOutIds = useMemo(
    () => new Set(stagedOutPlayers.map((player) => player.id.toString())),
    [stagedOutPlayers],
  );

  const visibleOwnedPlayers = useMemo(
    () =>
      ownedPlayers.filter((player) => !stagedOutIds.has(player.id.toString())),
    [ownedPlayers, stagedOutIds],
  );

  const filteredPlayers = useMemo(() => {
    return availablePlayers.filter((player) => {
      const matchesSearch = player.name
        .toLowerCase()
        .includes(searchQuery.trim().toLowerCase());
      const matchesSport =
        selectedSport === "All" || player.sport === selectedSport;
      const matchesPosition =
        selectedPosition === "All" || player.position === selectedPosition;

      return matchesSearch && matchesSport && matchesPosition;
    });
  }, [availablePlayers, searchQuery, selectedSport, selectedPosition]);

  const availableSportsForFilter = useMemo(
    () =>
      leagueSports.length > 0
        ? leagueSports
        : Array.from(
            new Set(
              availablePlayers
                .map((player) => player.sport)
                .filter((sport) => sport !== "cricket"),
            ),
          ),
    [leagueSports, availablePlayers],
  );

  const positionOptionsBySport = useMemo(() => {
    const bySport: Partial<Record<Sport, string[]>> = {
      All: ["All"],
    };

    for (const sport of availableSportsForFilter) {
      const sportPositions = Array.from(
        new Set(
          availablePlayers
            .filter((player) => player.sport === sport)
            .map((player) => player.position)
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b));

      bySport[sport] = ["All", ...sportPositions];
    }

    const allPositions = Array.from(
      new Set(
        availablePlayers.map((player) => player.position).filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
    bySport.All = ["All", ...allPositions];

    return bySport;
  }, [availablePlayers, availableSportsForFilter]);

  const handlePreviousPlayersPage = useCallback(() => {
    setPlayersPage((current) => Math.max(1, current - 1));
  }, []);

  const handleNextPlayersPage = useCallback(() => {
    if (!playersData?.has_next) {
      return;
    }

    setPlayersPage((current) => current + 1);
  }, [playersData?.has_next]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPlayersPage(1);
  }, []);

  const handleSportChange = useCallback((sport: Sport) => {
    setSelectedSport(sport);
    setSelectedPosition("All");
    setPlayersPage(1);
  }, []);

  const handlePositionChange = useCallback((position: string) => {
    setSelectedPosition(position);
    setPlayersPage(1);
  }, []);

  const handleAddPlayer = async (id: string) => {
    if (!isMultiSportLeague && stagedOutPlayers.length === 0) {
      toastifier.error("Stage out at least one player first");
      return;
    }

    if (
      !isMultiSportLeague &&
      stagedInPlayers.length >= stagedOutPlayers.length
    ) {
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
      const stagedIn = await stageInMutation.mutateAsync({
        league_id: leagueId,
        gameweek_id: activeWindow.id,
        player_id: player.id.toString(),
      });

      setSessionBudget(stagedIn.currentBudget);
      setTransfersRemaining(stagedIn.transfersRemaining);
      setStagedInPlayers((prev) => [...prev, player]);

      setToastState({
        status: "success",
        message: `${player.name} staged in`,
        token: Date.now(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transfer failed";
      setToastState({
        status: "error",
        message,
        token: Date.now(),
      });
    }
  };

  const handleStageOut = async (id: string) => {
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
        setToastState({
          status: "error",
          message: "No active transfer window",
          token: Date.now(),
        });
        return;
      }
      const staged = await stageOutMutation.mutateAsync({
        league_id: leagueId,
        gameweek_id: activeWindow.id,
        player_id: id,
      });
      setSelectedOutPlayer(player);
      setStagedOutPlayers((prev) => [...prev, player]);
      setSessionBudget(staged.currentBudget);
      setTransfersRemaining(staged.transfersAllowed - staged.transfersUsed);
      setToastState({
        status: "success",
        message: `${player.name} staged out`,
        token: Date.now(),
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unable to stage out";
      setToastState({ status: "error", message, token: Date.now() });
    }
  };

  const confirmAllTransfers = async () => {
    if (!leagueId || !activeWindow?.id) return;

    if (stagedOutPlayers.length === 0 && stagedInPlayers.length === 0) {
      toastifier.error("Stage at least one transfer action before confirming");
      return;
    }

    if (
      !isMultiSportLeague &&
      stagedOutPlayers.length !== stagedInPlayers.length
    ) {
      toastifier.error("Pending in/out counts must match before confirming");
      return;
    }

    try {
      const confirmed = await confirmTransfersMutation.mutateAsync({
        league_id: leagueId,
        gameweek_id: activeWindow.id,
      });

      setSessionBudget(confirmed.newBudget);
      setTransfersRemaining(confirmed.transfersRemaining);
      setSelectedOutPlayer(null);
      setStagedOutPlayers([]);
      setStagedInPlayers([]);
      setSessionBudget(null);
      setTransfersRemaining(null);
      setShowConfirmModal(false);

      setToastState({
        status: "success",
        message: "All staged transfers confirmed",
        token: Date.now(),
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to confirm transfers";
      setToastState({ status: "error", message, token: Date.now() });
    }
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedSport("All");
    setSelectedPosition("All");
    setSearchResetToken((prev) => prev + 1);
  };

  const isLoading =
    leagueLoading || teamLoading || playersLoading || windowLoading;
  const normalizedBudget = Number(myTeam?.current_budget ?? 0);
  const liveBudget = Number.isFinite(normalizedBudget) ? normalizedBudget : 0;
  const budget = sessionBudget ?? liveBudget;

  if (!leagueId) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8 text-foreground">
        <div className="mb-6 text-sm text-slate-400">
          Manager: {username || "Sporty User"}
        </div>
        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-xl">
          <h2 className="text-xl font-semibold text-foreground">
            Select a league to manage transfers.
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Your transfer history is still available below.
          </p>
        </div>

        <UserTransferHistoryCarousel
          groups={userTransferGroups ?? []}
          isLoading={userTransfersLoading}
          isError={Boolean(userTransfersError)}
        />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-8 font-[system-ui,-apple-system,Segoe_UI,Roboto,sans-serif] text-foreground">
      <div className="mb-6 text-sm text-slate-400">
        Manager: {username || "Sporty User"}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <TransfersHeader
            budget={budget}
            leagueName={league?.name || "Loading..."}
            currentWeek={activeWindow?.number || 0}
          />
          {transfersRemaining !== null ? (
            <div className="rounded-3xl border border-accent-primary/20 bg-accent-primary/10 px-4 py-2 text-sm text-accent-primary">
              Transfers remaining in session: {transfersRemaining}
            </div>
          ) : null}
          {stagedOutPlayers.length > 0 || stagedInPlayers.length > 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm backdrop-blur-xl">
              <p className="font-medium text-foreground">Staged Transfers</p>
              <p className="mt-1 text-slate-400">
                Out: {stagedOutPlayers.length} | In: {stagedInPlayers.length}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    Out
                  </p>
                  {stagedOutPlayers.map((player) => (
                    <p
                      key={player.id}
                      className="truncate text-xs text-foreground"
                    >
                      {player.name}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">
                    In
                  </p>
                  {stagedInPlayers.map((player) => (
                    <p
                      key={player.id}
                      className="truncate text-xs text-foreground"
                    >
                      {player.name}
                    </p>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={
                  confirmTransfersMutation.isPending ||
                  (stagedOutPlayers.length === 0 &&
                    stagedInPlayers.length === 0) ||
                  (!isMultiSportLeague &&
                    stagedOutPlayers.length !== stagedInPlayers.length) ||
                  !isTransfersOpen
                }
                className="mt-3 w-full rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {confirmTransfersMutation.isPending
                  ? "Confirming..."
                  : "Confirm All Staged Transfers"}
              </button>
              {isMultiSportLeague ? (
                <p className="mt-2 text-xs text-slate-400">
                  Multisport: you can stage players in directly when budget and
                  roster limits allow.
                </p>
              ) : null}
            </div>
          ) : null}
          <SearchBar
            onSearch={handleSearchChange}
            resetToken={searchResetToken}
          />

          <FilterBar
            selectedSport={selectedSport}
            selectedPosition={selectedPosition}
            availableSports={availableSportsForFilter}
            positionOptionsBySport={positionOptionsBySport}
            onSportChange={handleSportChange}
            onPositionChange={handlePositionChange}
          />

          <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span className="font-semibold text-foreground">
                Page {playersCurrentPage}
              </span>
              <span>/ {playersTotalPages}</span>
              <span className="hidden sm:inline">•</span>
              <span>{playersTotal} players total</span>
              {isPlayersPageLoading ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-primary/10 px-2.5 py-1 text-xs font-medium text-accent-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading players...
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePreviousPlayersPage}
                disabled={playersCurrentPage <= 1 || isPlayersPageLoading}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={handleNextPlayersPage}
                disabled={!playersData?.has_next || isPlayersPageLoading}
                className="inline-flex items-center gap-1 rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {isLoading ||
            (isPlayersPageLoading && availablePlayers.length === 0) ? (
              Array.from({ length: 5 }, (_, index) => (
                <PlayerCardSkeleton key={index} />
              ))
            ) : filteredPlayers.length === 0 ? (
              <EmptyTransfers onClearFilters={clearAllFilters} />
            ) : (
              filteredPlayers.map((player, index) => (
                <PlayerCard
                  key={player.id}
                  id={player.id}
                  name={player.name}
                  sport={player.sport}
                  position={player.position}
                  price={player.price}
                  avgPoints={player.avgPoints}
                  form={player.form}
                  onAdd={handleAddPlayer}
                  animationDelay={index * 60}
                  disabled={!isTransfersOpen}
                />
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <CurrentRoster
            players={visibleOwnedPlayers}
            onDrop={handleStageOut}
            budget={budget}
            maxPlayers={league?.squad_size || 15}
            selectedOutId={selectedOutPlayer?.id}
            disabled={!isTransfersOpen}
          />
          {selectedOutPlayer && (
            <div className="mt-4 flex items-center justify-between rounded-3xl border border-accent-primary/20 bg-accent-primary/10 p-4 animate-in fade-in slide-in-from-top-2">
              <div>
                <p className="text-xs font-bold uppercase text-accent-primary">
                  Player to swap out
                </p>
                <p className="font-semibold text-foreground">
                  {selectedOutPlayer.name}
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await cancelTransfersMutation.mutateAsync();
                  } catch {
                    // toast handled below on action buttons and global interceptor
                  }
                  setSelectedOutPlayer(null);
                  setStagedOutPlayers([]);
                  setStagedInPlayers([]);
                  setSessionBudget(null);
                  setTransfersRemaining(null);
                  setShowConfirmModal(false);
                }}
                className="text-slate-400 hover:text-foreground"
              >
                ✕
              </button>
            </div>
          )}
          {selectedOutPlayer ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  await cancelTransfersMutation.mutateAsync();
                  setSelectedOutPlayer(null);
                  setStagedOutPlayers([]);
                  setStagedInPlayers([]);
                  setSessionBudget(null);
                  setTransfersRemaining(null);
                  setShowConfirmModal(false);
                  setToastState({
                    status: "success",
                    message: "Transfer session canceled",
                    token: Date.now(),
                  });
                } catch (err: unknown) {
                  const message =
                    err instanceof Error
                      ? err.message
                      : "Unable to cancel session";
                  setToastState({
                    status: "error",
                    message,
                    token: Date.now(),
                  });
                }
              }}
              className="mt-3 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/8"
            >
              Cancel Staged Session
            </button>
          ) : null}
        </div>
      </div>

      <TransferConfirmation
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
        }}
        onConfirm={confirmAllTransfers}
        isLoading={confirmTransfersMutation.isPending}
        allowUnpaired={isMultiSportLeague}
        stagedOutPlayers={stagedOutPlayers}
        stagedInPlayers={stagedInPlayers}
        transfersOpen={isTransfersOpen}
        transferDeadlineAt={activeWindow?.transfer_deadline_at}
      />

      <TransferSuccess
        status={toastState.status}
        message={toastState.message}
        token={toastState.token}
      />

      <div className="mt-8">
        <UserTransferHistoryCarousel
          groups={userTransferGroups ?? []}
          isLoading={userTransfersLoading}
          isError={Boolean(userTransfersError)}
        />
      </div>
    </section>
  );
}

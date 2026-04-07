"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { EmptyTransfers } from "@/components/ui/empty-states";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";
import {
  useActiveWindow,
  useCancelTransfers,
  useConfirmTransfers,
  useLeague,
  useMyTeam,
  useStageIn,
  useStageOut,
} from "@/hooks/leagues/useLeagues";
import { usePlayers } from "@/hooks/players/usePlayers";
import { toastifier } from "@/libs/toastifier";

const toSport = (value?: string): Exclude<Sport, "All"> => {
  if (value === "football" || value === "basketball") {
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
  const { data: activeWindow, isLoading: windowLoading } =
    useActiveWindow(leagueId);
  const { data: playersData, isLoading: playersLoading } = usePlayers({
    sport_name: league?.sports?.[0]?.sport.name,
    league_id: leagueId || undefined,
  });
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

  const handleAddPlayer = async (id: string) => {
    if (stagedOutPlayers.length === 0) {
      toastifier.error("Stage out at least one player first");
      return;
    }

    if (stagedInPlayers.length >= stagedOutPlayers.length) {
      toastifier.error("You have already staged enough players in");
      return;
    }

    const player = availablePlayers.find((item) => item.id === id);
    if (!player) return;

    if (!leagueId || !activeWindow?.id) {
      toastifier.error("No active transfer window right now");
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
    if (!activeWindow?.id) {
      toastifier.error("No active transfer window right now");
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

    if (stagedOutPlayers.length === 0 || stagedInPlayers.length === 0) {
      toastifier.error("Stage players out and in before confirming");
      return;
    }

    if (stagedOutPlayers.length !== stagedInPlayers.length) {
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
      <div className="mx-auto max-w-7xl px-6 py-12 text-center">
        <h2 className="text-xl font-semibold">
          Please select a league from your dashboard to manage transfers.
        </h2>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-8 font-[system-ui,-apple-system,Segoe_UI,Roboto,sans-serif] text-gray-900">
      <div className="mb-6 text-sm text-gray-500">
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
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-700">
              Transfers remaining in session: {transfersRemaining}
            </div>
          ) : null}
          {stagedOutPlayers.length > 0 || stagedInPlayers.length > 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
              <p className="font-medium text-gray-900">Staged Transfers</p>
              <p className="mt-1 text-gray-600">
                Out: {stagedOutPlayers.length} | In: {stagedInPlayers.length}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    Out
                  </p>
                  {stagedOutPlayers.map((player) => (
                    <p
                      key={player.id}
                      className="truncate text-xs text-gray-700"
                    >
                      {player.name}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">
                    In
                  </p>
                  {stagedInPlayers.map((player) => (
                    <p
                      key={player.id}
                      className="truncate text-xs text-gray-700"
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
                  stagedOutPlayers.length === 0 ||
                  stagedOutPlayers.length !== stagedInPlayers.length
                }
                className="mt-3 w-full rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {confirmTransfersMutation.isPending
                  ? "Confirming..."
                  : "Confirm All Staged Transfers"}
              </button>
            </div>
          ) : null}
          <SearchBar onSearch={setSearchQuery} resetToken={searchResetToken} />
          <FilterBar
            selectedSport={selectedSport}
            selectedPosition={selectedPosition}
            onSportChange={setSelectedSport}
            onPositionChange={setSelectedPosition}
          />

          <div className="space-y-3">
            {isLoading ? (
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
          />
          {selectedOutPlayer && (
            <div className="mt-4 p-4 bg-primary-50 rounded-xl border border-primary-100 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
              <div>
                <p className="text-xs text-primary-600 font-bold uppercase">
                  Player to swap out
                </p>
                <p className="font-semibold">{selectedOutPlayer.name}</p>
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
                className="text-gray-400 hover:text-gray-600"
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
              className="mt-3 w-full rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
        stagedOutPlayers={stagedOutPlayers}
        stagedInPlayers={stagedInPlayers}
      />

      <TransferSuccess
        status={toastState.status}
        message={toastState.message}
        token={toastState.token}
      />
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  TransferConfirmation,
  type SelectedPlayer,
} from "@/components/dashboard/transfers/components/TransferConfirmation";
import { TransfersHeader } from "@/components/dashboard/transfers/components/TransfersHeader";
import { TransferSuccess } from "@/components/dashboard/transfers/components/TransferSuccess";
import { EmptyTransfers } from "@/components/ui/empty-states";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";
import { useLeague, useMyTeam, useMakeTransfer } from "@/hooks/leagues/useLeagues";
import { usePlayers } from "@/hooks/players/usePlayers";

export function Transfers() {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get("leagueId") || "";
  const { username } = useMe();

  const { data: league, isLoading: leagueLoading } = useLeague(leagueId);
  const { data: myTeam, isLoading: teamLoading } = useMyTeam(leagueId);
  const { data: playersData, isLoading: playersLoading } = usePlayers({
    sport_name: league?.sports?.[0]?.sport.name,
    league_id: leagueId || undefined
  });
  const makeTransferMutation = useMakeTransfer(leagueId);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResetToken, setSearchResetToken] = useState(0);
  const [selectedSport, setSelectedSport] = useState<Sport>("All");
  const [selectedPosition, setSelectedPosition] = useState("All");

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedInPlayer, setSelectedInPlayer] = useState<SelectedPlayer | null>(null);
  const [selectedOutPlayer, setSelectedOutPlayer] = useState<OwnedPlayer | null>(null);

  const [toastState, setToastState] = useState<{
    status: "success" | "error" | null;
    message: string;
    token: number;
  }>({
    status: null,
    message: "",
    token: 0,
  });

  const ownedPlayers: OwnedPlayer[] = useMemo(() => {
    if (!myTeam?.players) return [];
    return myTeam.players.map(p => ({
      id: p.player.id as any,
      name: p.player.display_name,
      sport: p.player.sport_name as any,
      position: p.player.position,
      price: Number(p.player.current_cost),
      avgPoints: 0,
      form: 0,
    }));
  }, [myTeam]);

  const availablePlayers = useMemo(() => {
    if (!playersData?.items) return [];
    const ownedIds = new Set(ownedPlayers.map(p => p.id.toString()));
    return playersData.items
      .filter(p => !ownedIds.has(p.id))
      .map(p => ({
        id: p.id as any,
        name: p.display_name,
        sport: p.sport.name as any,
        position: p.position,
        price: Number(p.current_cost),
        avgPoints: 0,
        form: 0,
      }));
  }, [playersData, ownedPlayers]);

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

  const handleAddPlayer = (id: any) => {
    const player = availablePlayers.find((item) => item.id === id);
    if (!player) return;
    setSelectedInPlayer(player);
    setShowConfirmModal(true);
  };

  const confirmTransfer = async () => {
    if (!selectedInPlayer || !selectedOutPlayer || !leagueId) return;

    try {
      await makeTransferMutation.mutateAsync({
        player_in_id: selectedInPlayer.id.toString(),
        player_out_id: selectedOutPlayer.id.toString(),
      });

      setToastState({
        status: "success",
        message: `Transfer completed: ${selectedInPlayer.name} is in!`,
        token: Date.now(),
      });
      setShowConfirmModal(false);
      setSelectedInPlayer(null);
      setSelectedOutPlayer(null);
    } catch (err: any) {
      setToastState({
        status: "error",
        message: err?.response?.data?.detail || err.message || "Transfer failed",
        token: Date.now(),
      });
    }
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setSelectedSport("All");
    setSelectedPosition("All");
    setSearchResetToken((prev) => prev + 1);
  };

  const isLoading = leagueLoading || teamLoading || playersLoading;

  if (!leagueId) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-12 text-center">
        <h2 className="text-xl font-semibold">Please select a league from your dashboard to manage transfers.</h2>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-8 text-gray-900 [font-family:system-ui,-apple-system,Segoe_UI,Roboto,sans-serif]">
      <div className="mb-6 text-sm text-gray-500">
        Manager: {username || "Sporty User"}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <TransfersHeader
            budget={myTeam?.current_budget || 0}
            leagueName={league?.name || "Loading..."}
            currentWeek={24} // TODO: Get from backend
          />
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
            players={ownedPlayers}
            onDrop={(id) => {
              const player = ownedPlayers.find(p => p.id === id);
              if (player) setSelectedOutPlayer(player);
            }}
            budget={myTeam?.current_budget || 0}
            maxPlayers={league?.squad_size || 15}
            selectedOutId={selectedOutPlayer?.id}
          />
          {selectedOutPlayer && (
            <div className="mt-4 p-4 bg-primary-50 rounded-xl border border-primary-100 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
              <div>
                <p className="text-xs text-primary-600 font-bold uppercase">Player to swap out</p>
                <p className="font-semibold">{selectedOutPlayer.name}</p>
              </div>
              <button
                onClick={() => setSelectedOutPlayer(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      <TransferConfirmation
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSelectedInPlayer(null);
        }}
        player={selectedInPlayer}
        onConfirm={confirmTransfer}
        isLoading={makeTransferMutation.isPending}
        selectedOutPlayer={selectedOutPlayer}
      />

      <TransferSuccess
        status={toastState.status}
        message={toastState.message}
        token={toastState.token}
      />
    </section>
  );
}

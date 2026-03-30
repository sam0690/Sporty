"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { CurrentRoster, type OwnedPlayer } from "@/components/dashboard/transfers/components/CurrentRoster";
import { EmptyState } from "@/components/dashboard/transfers/components/EmptyState";
import { FilterBar, type Sport } from "@/components/dashboard/transfers/components/FilterBar";
import { PlayerCard } from "@/components/dashboard/transfers/components/PlayerCard";
import { SearchBar } from "@/components/dashboard/transfers/components/SearchBar";
import {
  TransferConfirmation,
  type SelectedPlayer,
} from "@/components/dashboard/transfers/components/TransferConfirmation";
import { TransfersHeader } from "@/components/dashboard/transfers/components/TransfersHeader";
import { TransferSuccess } from "@/components/dashboard/transfers/components/TransferSuccess";

type AvailablePlayer = {
  id: number;
  name: string;
  sport: Exclude<Sport, "All">;
  position: string;
  price: number;
  avgPoints: number;
  form?: number;
};

const mockOwnedPlayers: OwnedPlayer[] = [
  { id: 1, name: "Lionel Messi", sport: "football", position: "Forward", price: 25 },
  { id: 2, name: "LeBron James", sport: "basketball", position: "Forward", price: 30 },
  { id: 3, name: "Virat Kohli", sport: "cricket", position: "Batsman", price: 20 },
];

const mockAvailablePlayers: AvailablePlayer[] = [
  { id: 4, name: "Kylian Mbappe", sport: "football", position: "Forward", price: 28, avgPoints: 14.2, form: 9 },
  { id: 5, name: "Stephen Curry", sport: "basketball", position: "Guard", price: 32, avgPoints: 18.5, form: 8 },
  { id: 6, name: "Jasprit Bumrah", sport: "cricket", position: "Bowler", price: 22, avgPoints: 10.8, form: 7 },
  { id: 7, name: "Erling Haaland", sport: "football", position: "Forward", price: 35, avgPoints: 16.5, form: 10 },
  { id: 8, name: "Nikola Jokic", sport: "basketball", position: "Center", price: 34, avgPoints: 17.2, form: 9 },
];

export function Transfers() {
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState<Sport>("All");
  const [selectedPosition, setSelectedPosition] = useState("All");
  const [budget, setBudget] = useState(100);
  const [ownedPlayers, setOwnedPlayers] = useState<OwnedPlayer[]>(mockOwnedPlayers);
  const [availablePlayers, setAvailablePlayers] =
    useState<AvailablePlayer[]>(mockAvailablePlayers);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null);
  const [toastState, setToastState] = useState<{
    status: "success" | "error" | null;
    message: string;
    token: number;
  }>({
    status: null,
    message: "",
    token: 0,
  });

  const handleAddPlayer = (id: number) => {
    const player = availablePlayers.find((item) => item.id === id);
    if (!player) {
      return;
    }

    setSelectedPlayer(player);
    setShowConfirmModal(true);
  };

  const confirmTransfer = () => {
    if (!selectedPlayer) {
      return;
    }

    if (selectedPlayer.price > budget) {
      setToastState({
        status: "error",
        message: "Insufficient budget",
        token: Date.now(),
      });
      return;
    }

    setBudget((prev) => Number((prev - selectedPlayer.price).toFixed(1)));
    setOwnedPlayers((prev) => [
      ...prev,
      {
        id: selectedPlayer.id,
        name: selectedPlayer.name,
        sport: selectedPlayer.sport,
        position: selectedPlayer.position,
        price: selectedPlayer.price,
      },
    ]);
    setAvailablePlayers((prev) => prev.filter((item) => item.id !== selectedPlayer.id));
    setToastState({
      status: "success",
      message: `${selectedPlayer.name} added to your team`,
      token: Date.now(),
    });
    setShowConfirmModal(false);
    setSelectedPlayer(null);
  };

  const handleDropPlayer = (id: number) => {
    const droppedPlayer = ownedPlayers.find((player) => player.id === id);
    if (!droppedPlayer) {
      return;
    }

    setOwnedPlayers((prev) => prev.filter((player) => player.id !== id));
    setBudget((prev) => Number((prev + droppedPlayer.price).toFixed(1)));
    setToastState({
      status: "success",
      message: `${droppedPlayer.name} removed from your team`,
      token: Date.now(),
    });
  };

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

  const hasFilters =
    searchQuery.trim().length > 0 ||
    selectedSport !== "All" ||
    selectedPosition !== "All";

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-text-primary">
      <div className="mb-6 text-sm text-text-secondary">
        Manager: {user?.name ?? "Sporty User"}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <TransfersHeader budget={budget} leagueName="Premier League Champions" currentWeek={24} />
          <SearchBar onSearch={setSearchQuery} />
          <FilterBar
            selectedSport={selectedSport}
            selectedPosition={selectedPosition}
            onSportChange={setSelectedSport}
            onPositionChange={setSelectedPosition}
          />

          <div className="grid grid-cols-1 gap-3">
            {filteredPlayers.length === 0 ? (
              <EmptyState hasFilters={hasFilters} />
            ) : (
              filteredPlayers.map((player) => (
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
                />
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <CurrentRoster players={ownedPlayers} onDrop={handleDropPlayer} />
        </div>
      </div>

      <TransferConfirmation
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSelectedPlayer(null);
        }}
        player={selectedPlayer}
        onConfirm={confirmTransfer}
      />

      <TransferSuccess
        status={toastState.status}
        message={toastState.message}
        token={toastState.token}
      />
    </section>
  );
}

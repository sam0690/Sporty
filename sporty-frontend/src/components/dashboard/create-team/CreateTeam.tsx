"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { ConfirmationModal } from "@/components/dashboard/create-team/components/ConfirmationModal";
import { CreateTeamHeader } from "@/components/dashboard/create-team/components/CreateTeamHeader";
import { CurrentTeam } from "@/components/dashboard/create-team/components/CurrentTeam";
import { PlayerMarket } from "@/components/dashboard/create-team/components/PlayerMarket";
import { SuccessModal } from "@/components/dashboard/create-team/components/SuccessModal";
import { TeamNameForm } from "@/components/dashboard/create-team/components/TeamNameForm";
import type { MarketPlayer } from "@/components/dashboard/create-team/components/PlayerCard";

type LeagueSetup = {
  leagueId: string;
  leagueName: string;
  sport: "football" | "basketball" | "cricket" | "multisport";
  budget: number;
  requiredPlayers: number;
  availablePlayers: MarketPlayer[];
};

const mockLeagueSetups: Record<string, LeagueSetup> = {
  "1": {
    leagueId: "1",
    leagueName: "Premier League Champions",
    sport: "football",
    budget: 100,
    requiredPlayers: 11,
    availablePlayers: [
      { id: 1, name: "Lionel Messi", sport: "football", icon: "⚽", position: "Forward", price: 25, projected: 12.5 },
      { id: 2, name: "Cristiano Ronaldo", sport: "football", icon: "⚽", position: "Forward", price: 24, projected: 11.8 },
      { id: 3, name: "Kevin De Bruyne", sport: "football", icon: "⚽", position: "Midfielder", price: 22, projected: 9.2 },
      { id: 4, name: "Rodri", sport: "football", icon: "⚽", position: "Midfielder", price: 18, projected: 7.5 },
      { id: 5, name: "Virgil van Dijk", sport: "football", icon: "⚽", position: "Defender", price: 16, projected: 6.8 },
      { id: 6, name: "Trent Alexander-Arnold", sport: "football", icon: "⚽", position: "Defender", price: 17, projected: 7.2 },
      { id: 7, name: "Alisson", sport: "football", icon: "⚽", position: "Goalkeeper", price: 15, projected: 5.5 },
      { id: 8, name: "Erling Haaland", sport: "football", icon: "⚽", position: "Forward", price: 28, projected: 14.0 },
      { id: 9, name: "Jude Bellingham", sport: "football", icon: "⚽", position: "Midfielder", price: 23, projected: 10.5 },
      { id: 10, name: "Ruben Dias", sport: "football", icon: "⚽", position: "Defender", price: 14, projected: 6.0 },
      { id: 11, name: "Phil Foden", sport: "football", icon: "⚽", position: "Midfielder", price: 20, projected: 9.0 },
      { id: 12, name: "Bukayo Saka", sport: "football", icon: "⚽", position: "Forward", price: 21, projected: 10.1 },
    ],
  },
  "2": {
    leagueId: "2",
    leagueName: "NBA Fantasy 2025",
    sport: "basketball",
    budget: 100,
    requiredPlayers: 5,
    availablePlayers: [
      { id: 1, name: "Stephen Curry", sport: "basketball", icon: "🏀", position: "PG", price: 32, projected: 18.5 },
      { id: 2, name: "LeBron James", sport: "basketball", icon: "🏀", position: "SF", price: 30, projected: 16.8 },
      { id: 3, name: "Nikola Jokic", sport: "basketball", icon: "🏀", position: "C", price: 34, projected: 19.5 },
      { id: 4, name: "Luka Doncic", sport: "basketball", icon: "🏀", position: "PG", price: 33, projected: 17.8 },
      { id: 5, name: "Kevin Durant", sport: "basketball", icon: "🏀", position: "PF", price: 31, projected: 17.2 },
      { id: 6, name: "Giannis Antetokounmpo", sport: "basketball", icon: "🏀", position: "PF", price: 35, projected: 18.0 },
    ],
  },
  "3": {
    leagueId: "3",
    leagueName: "Cricket World Cup",
    sport: "cricket",
    budget: 100,
    requiredPlayers: 11,
    availablePlayers: [
      { id: 1, name: "Virat Kohli", sport: "cricket", icon: "🏏", position: "Batsman", price: 28, projected: 14.2 },
      { id: 2, name: "Rohit Sharma", sport: "cricket", icon: "🏏", position: "Batsman", price: 26, projected: 13.5 },
      { id: 3, name: "Jasprit Bumrah", sport: "cricket", icon: "🏏", position: "Bowler", price: 24, projected: 10.2 },
      { id: 4, name: "Ravindra Jadeja", sport: "cricket", icon: "🏏", position: "AllRounder", price: 25, projected: 12.2 },
      { id: 5, name: "MS Dhoni", sport: "cricket", icon: "🏏", position: "WK", price: 22, projected: 8.5 },
      { id: 6, name: "Shubman Gill", sport: "cricket", icon: "🏏", position: "Batsman", price: 24, projected: 11.8 },
      { id: 7, name: "KL Rahul", sport: "cricket", icon: "🏏", position: "WK", price: 20, projected: 9.0 },
      { id: 8, name: "Hardik Pandya", sport: "cricket", icon: "🏏", position: "AllRounder", price: 23, projected: 10.6 },
      { id: 9, name: "Mohammed Shami", sport: "cricket", icon: "🏏", position: "Bowler", price: 19, projected: 8.4 },
      { id: 10, name: "Kuldeep Yadav", sport: "cricket", icon: "🏏", position: "Bowler", price: 18, projected: 8.1 },
      { id: 11, name: "Suryakumar Yadav", sport: "cricket", icon: "🏏", position: "Batsman", price: 21, projected: 9.9 },
      { id: 12, name: "Rinku Singh", sport: "cricket", icon: "🏏", position: "Batsman", price: 17, projected: 7.2 },
    ],
  },
  "4": {
    leagueId: "4",
    leagueName: "Ultimate All-Stars",
    sport: "multisport",
    budget: 150,
    requiredPlayers: 9,
    availablePlayers: [
      { id: 1, name: "Lionel Messi", sport: "football", icon: "⚽", position: "Forward", price: 25, projected: 12.5 },
      { id: 2, name: "Cristiano Ronaldo", sport: "football", icon: "⚽", position: "Forward", price: 24, projected: 11.8 },
      { id: 3, name: "Kevin De Bruyne", sport: "football", icon: "⚽", position: "Midfielder", price: 22, projected: 9.2 },
      { id: 4, name: "Stephen Curry", sport: "basketball", icon: "🏀", position: "PG", price: 32, projected: 18.5 },
      { id: 5, name: "LeBron James", sport: "basketball", icon: "🏀", position: "SF", price: 30, projected: 16.8 },
      { id: 6, name: "Nikola Jokic", sport: "basketball", icon: "🏀", position: "C", price: 34, projected: 19.5 },
      { id: 7, name: "Virat Kohli", sport: "cricket", icon: "🏏", position: "Batsman", price: 28, projected: 14.2 },
      { id: 8, name: "Jasprit Bumrah", sport: "cricket", icon: "🏏", position: "Bowler", price: 24, projected: 10.2 },
      { id: 9, name: "Ravindra Jadeja", sport: "cricket", icon: "🏏", position: "AllRounder", price: 25, projected: 12.2 },
      { id: 10, name: "Erling Haaland", sport: "football", icon: "⚽", position: "Forward", price: 28, projected: 14.0 },
      { id: 11, name: "Luka Doncic", sport: "basketball", icon: "🏀", position: "PG", price: 33, projected: 17.8 },
      { id: 12, name: "Rohit Sharma", sport: "cricket", icon: "🏏", position: "Batsman", price: 26, projected: 13.5 },
    ],
  },
};

export function CreateTeam() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const leagueId = searchParams.get("leagueId") ?? "1";
  const setup = mockLeagueSetups[leagueId] ?? mockLeagueSetups["1"];

  const [step, setStep] = useState(1);
  const [selectedPlayers, setSelectedPlayers] = useState<MarketPlayer[]>([]);
  const [teamName, setTeamName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("All");
  const [selectedSport, setSelectedSport] = useState("All");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStep(1);
    setSelectedPlayers([]);
    setTeamName("");
    setShowConfirmModal(false);
    setShowSuccessModal(false);
    setSearchQuery("");
    setSelectedPosition("All");
    setSelectedSport("All");
    setError(null);
  }, [leagueId]);

  const selectedPlayerIds = useMemo(() => selectedPlayers.map((player) => player.id), [selectedPlayers]);
  const totalCost = useMemo(() => selectedPlayers.reduce((sum, player) => sum + player.price, 0), [selectedPlayers]);
  const remainingBudget = setup.budget - totalCost;

  const handleAddPlayer = (player: MarketPlayer) => {
    setError(null);

    if (selectedPlayerIds.includes(player.id)) {
      setError("Cannot add the same player twice.");
      return;
    }

    if (selectedPlayers.length >= setup.requiredPlayers) {
      setError(`You must select exactly ${setup.requiredPlayers} players.`);
      return;
    }

    if (remainingBudget < player.price) {
      setError("Cannot exceed budget.");
      return;
    }

    setSelectedPlayers((prev) => [...prev, player]);
  };

  const handleRemovePlayer = (playerId: number) => {
    setError(null);
    setSelectedPlayers((prev) => prev.filter((player) => player.id !== playerId));
  };

  const handleNextStep = () => {
    if (selectedPlayers.length !== setup.requiredPlayers) {
      setError(`Select exactly ${setup.requiredPlayers} players to continue.`);
      return;
    }

    if (remainingBudget < 0) {
      setError("Budget exceeded. Remove some players.");
      return;
    }

    setError(null);
    setStep(2);
  };

  const handleContinueToConfirmation = () => {
    if (teamName.trim().length < 1) {
      setError("Team name is required.");
      return;
    }

    setError(null);
    setStep(3);
    setShowConfirmModal(true);
  };

  const handleCreateTeam = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    setShowConfirmModal(false);
    setShowSuccessModal(true);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 text-text-primary">
      <p className="text-sm text-text-secondary">Manager: {user?.name ?? "Sporty User"}</p>

      <CreateTeamHeader
        leagueName={setup.leagueName}
        sport={setup.sport}
        budget={setup.budget}
        remainingBudget={remainingBudget}
        step={step}
        totalSteps={3}
        selectedCount={selectedPlayers.length}
        requiredCount={setup.requiredPlayers}
      />

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      ) : null}

      {step === 1 ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PlayerMarket
                players={setup.availablePlayers}
                onAddPlayer={handleAddPlayer}
                onRemovePlayer={handleRemovePlayer}
                selectedPlayerIds={selectedPlayerIds}
                sport={setup.sport}
                remainingBudget={remainingBudget}
                searchQuery={searchQuery}
                selectedPosition={selectedPosition}
                selectedSport={selectedSport}
                onSearchQueryChange={setSearchQuery}
                onPositionChange={setSelectedPosition}
                onSportChange={setSelectedSport}
              />
            </div>

            <div className="lg:col-span-1">
              <CurrentTeam
                players={selectedPlayers}
                onRemovePlayer={handleRemovePlayer}
                budget={setup.budget}
                totalCost={totalCost}
                requiredPlayers={setup.requiredPlayers}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleNextStep}
              disabled={selectedPlayers.length !== setup.requiredPlayers || remainingBudget < 0}
              className="rounded-lg bg-primary-500 px-5 py-2 font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <TeamNameForm
          teamName={teamName}
          onTeamNameChange={setTeamName}
          onSubmit={handleContinueToConfirmation}
          onBack={() => setStep(1)}
        />
      ) : null}

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setStep(2);
        }}
        onConfirm={handleCreateTeam}
        isLoading={isLoading}
        teamData={{
          teamName: teamName.trim(),
          leagueName: setup.leagueName,
          selectedCount: selectedPlayers.length,
          requiredPlayers: setup.requiredPlayers,
          totalCost,
          remainingBudget,
        }}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        leagueId={setup.leagueId}
        teamName={teamName || "Your Team"}
      />
    </section>
  );
}

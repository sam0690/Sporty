"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { ConfirmationModal } from "@/components/dashboard/create-team/components/ConfirmationModal";
import { CreateTeamHeader } from "@/components/dashboard/create-team/components/CreateTeamHeader";
import { CurrentTeam } from "@/components/dashboard/create-team/components/CurrentTeam";
import { PlayerMarket } from "@/components/dashboard/create-team/components/PlayerMarket";
import { SuccessModal } from "@/components/dashboard/create-team/components/SuccessModal";
import { TeamNameForm } from "@/components/dashboard/create-team/components/TeamNameForm";
import type { MarketPlayer } from "@/components/dashboard/create-team/components/PlayerCard";
import { useLeague, useBuildTeam } from "@/hooks/leagues/useLeagues";
import { usePlayers } from "@/hooks/players/usePlayers";
import { CardSkeleton } from "@/components/ui/skeletons";

export function CreateTeam() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { username } = useMe();
  const leagueId = searchParams.get("leagueId");

  const { data: league, isLoading: leagueLoading } = useLeague(leagueId || "");
  const { data: playersData, isLoading: playersLoading } = usePlayers({
    sport_name: league?.sports?.[0]?.sport.name,
    league_id: leagueId || undefined
  });
  const buildTeamMutation = useBuildTeam();

  const [step, setStep] = useState(1);
  const [selectedPlayers, setSelectedPlayers] = useState<MarketPlayer[]>([]);
  const [teamName, setTeamName] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("All");
  const [selectedSport, setSelectedSport] = useState("All");
  const [error, setError] = useState<string | null>(null);

  const marketPlayers: MarketPlayer[] = useMemo(() => {
    if (!playersData?.items) return [];
    return playersData.items.map(p => ({
      id: p.id as any,
      name: p.display_name,
      sport: p.sport.name as any,
      icon: p.sport.name === "football" ? "⚽" : p.sport.name === "basketball" ? "🏀" : "🏏",
      position: p.position,
      price: Number(p.current_cost),
      projected: 0,
    }));
  }, [playersData]);

  const selectedPlayerIds = useMemo(
    () => selectedPlayers.map((player) => player.id),
    [selectedPlayers],
  );

  const totalCost = useMemo(
    () => selectedPlayers.reduce((sum, player) => sum + player.price, 0),
    [selectedPlayers],
  );

  const budget = league?.budget_per_team || 100;
  const requiredPlayers = league?.squad_size || 15;
  const remainingBudget = budget - totalCost;

  const handleAddPlayer = (player: MarketPlayer) => {
    setError(null);
    if (selectedPlayerIds.includes(player.id)) {
      setError("Cannot add the same player twice.");
      return;
    }
    if (selectedPlayers.length >= requiredPlayers) {
      setError(`You must select exactly ${requiredPlayers} players.`);
      return;
    }
    if (remainingBudget < player.price) {
      setError("Cannot exceed budget.");
      return;
    }
    setSelectedPlayers((prev) => [...prev, player]);
  };

  const handleRemovePlayer = (playerId: any) => {
    setError(null);
    setSelectedPlayers((prev) =>
      prev.filter((player) => player.id !== playerId),
    );
  };

  const handleNextStep = () => {
    if (selectedPlayers.length !== requiredPlayers) {
      setError(`Select exactly ${requiredPlayers} players to continue.`);
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
    if (!leagueId) return;
    try {
      await buildTeamMutation.mutateAsync({
        id: leagueId,
        payload: {
          team_name: teamName.trim(),
          player_ids: selectedPlayerIds.map(id => id.toString()),
        }
      });
      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || "Failed to create team");
      setShowConfirmModal(false);
      setStep(2);
    }
  };

  if (leagueLoading || !league) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-6">
        <CardSkeleton />
      </div>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 text-gray-900 [font-family:system-ui,-apple-system]">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Manager: {username || "Sporty User"}
        </p>
        <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-semibold uppercase tracking-wider">
          {league.sports[0]?.sport.display_name || "Multisport"}
        </span>
      </div>

      <CreateTeamHeader
        leagueName={league.name}
        sport={league.sports[0]?.sport.name as any}
        budget={budget}
        remainingBudget={remainingBudget}
        step={step}
        totalSteps={3}
        selectedCount={selectedPlayers.length}
        requiredCount={requiredPlayers}
      />

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PlayerMarket
                players={marketPlayers}
                onAddPlayer={handleAddPlayer}
                onRemovePlayer={handleRemovePlayer}
                selectedPlayerIds={selectedPlayerIds as any}
                sport={league.sports[0]?.sport.name as any}
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
                budget={budget}
                totalCost={totalCost}
                requiredPlayers={requiredPlayers}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={handleNextStep}
              disabled={
                selectedPlayers.length !== requiredPlayers ||
                remainingBudget < 0
              }
              className="rounded-full bg-primary-600 px-10 py-3 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg transition-all"
            >
              Review Team & Name
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
        isLoading={buildTeamMutation.isPending}
        teamData={{
          teamName: teamName.trim(),
          leagueName: league.name,
          selectedCount: selectedPlayers.length,
          requiredPlayers: requiredPlayers,
          totalCost,
          remainingBudget,
        }}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => router.push(`/leagues`)}
        leagueId={leagueId || ""}
        teamName={teamName || "Your Team"}
      />
    </section>
  );
}

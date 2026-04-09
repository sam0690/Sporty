"use client";

import { useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { CreateTeamHeader } from "@/components/dashboard/create-team/components/CreateTeamHeader";
import { CurrentTeam } from "@/components/dashboard/create-team/components/CurrentTeam";
import { PlayerMarket } from "@/components/dashboard/create-team/components/PlayerMarket";
import { TeamNameForm } from "@/components/dashboard/create-team/components/TeamNameForm";
import type { MarketPlayer } from "@/components/dashboard/create-team/components/PlayerCard";
import {
  useLeague,
  useBuildTeam,
  useDiscardTeamPlayer,
  useDraftTurn,
  useMakeDraftPick,
  useMyTeam,
} from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";
import { usePlayers } from "@/hooks/players/usePlayers";
import { CardSkeleton } from "@/components/ui/skeletons";
import { toastifier } from "@/libs/toastifier";

const sportIconByName: Record<string, string> = {
  football: "⚽",
  basketball: "🏀",
};

const MULTISPORT_MIN_BY_SPORT = {
  football: 5,
  basketball: 4,
} as const;

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

type CreateTeamProps = {
  leagueId?: string;
};

type BudgetCostFilter = "All" | "Under 5" | "5 - 8" | "Above 8";

export function CreateTeam({ leagueId: leagueIdProp }: CreateTeamProps = {}) {
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { username, data: me } = useMe();
  const leagueId = leagueIdProp || params?.id || searchParams.get("leagueId");

  const { data: league, isLoading: leagueLoading } = useLeague(leagueId || "");
  const { data: myTeam } = useMyTeam(leagueId || "");

  const leagueSport = normalizeLeagueSport(league?.sports);
  const isMultiSportLeague = leagueSport === "multisport";
  const { isDraftMode: isDraftLeague } = useLeagueCompetitionMode(league);

  const { data: playersData, isLoading: playersLoading } = usePlayers({
    league_id: leagueId || undefined,
    ...(isDraftLeague || isMultiSportLeague
      ? {}
      : { sport_name: league?.sports?.[0]?.sport.name }),
  });

  const buildTeamMutation = useBuildTeam();
  const makeDraftPickMutation = useMakeDraftPick(leagueId || "");
  const discardTeamPlayerMutation = useDiscardTeamPlayer(leagueId || "");
  const { data: draftTurn } = useDraftTurn(
    leagueId || "",
    !!leagueId && isDraftLeague && league?.status === "drafting",
  );

  const [step, setStep] = useState(1);
  const [selectedPlayers, setSelectedPlayers] = useState<MarketPlayer[]>([]);
  const [teamName, setTeamName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("All");
  const [selectedSport, setSelectedSport] = useState("All");
  const [selectedCostFilter, setSelectedCostFilter] =
    useState<BudgetCostFilter>("All");
  const [error, setError] = useState<string | null>(null);
  const [pickHistory, setPickHistory] = useState<string[]>([]);

  const marketPlayers: MarketPlayer[] = useMemo(() => {
    if (!playersData?.items) return [];
    return playersData.items.map((p) => ({
      id: p.id,
      name: p.display_name,
      sport: p.sport.name as "football" | "basketball",
      icon: sportIconByName[p.sport.name] ?? "🏅",
      position: p.position,
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
        price: Number(player.cost),
        projected: 0,
      };
    });
  }, [myTeam]);

  const selectedPlayerIds = useMemo(
    () => selectedPlayers.map((player) => player.id),
    [selectedPlayers],
  );

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

  const rawBudget = Number(league?.budget_per_team ?? 100);
  const budget = Number.isFinite(rawBudget) ? rawBudget : 100;
  const rawSquadSize = Number(league?.squad_size ?? 15);
  const requiredPlayers = Number.isFinite(rawSquadSize) ? rawSquadSize : 15;
  const minPlayersRequired = isMultiSportLeague
    ? 13
    : leagueSport === "football" || leagueSport === "basketball"
      ? 12
      : requiredPlayers;
  const maxPlayersAllowed = isMultiSportLeague
    ? 15
    : leagueSport === "football" || leagueSport === "basketball"
      ? 15
      : requiredPlayers;
  const remainingBudget = budget - totalCost;
  const budgetUsed = Math.max(0, budget - remainingBudget);
  const budgetProgress =
    budget > 0 ? Math.min(100, (budgetUsed / budget) * 100) : 0;

  const filteredMarketPlayers = useMemo(() => {
    return marketPlayers.filter((player) => {
      if (selectedCostFilter === "Under 5") {
        return player.price < 5;
      }

      if (selectedCostFilter === "5 - 8") {
        return player.price >= 5 && player.price <= 8;
      }

      if (selectedCostFilter === "Above 8") {
        return player.price > 8;
      }

      return true;
    });
  }, [marketPlayers, selectedCostFilter]);

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

  const handleNextStep = () => {
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

    setError(null);
    setStep(2);
  };

  const handleCreateTeam = async () => {
    if (!leagueId) return;
    try {
      if (teamName.trim().length < 1) {
        const message = "Team name is required.";
        setError(message);
        toastifier.info(message);
        return;
      }
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
          team_name: teamName.trim(),
          player_ids: selectedPlayerIds.map((id) => id.toString()),
        },
      });

      router.push(`/leagues/${leagueId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create team");
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

  if (isDraftLeague) {
    const status = league.status;

    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 text-gray-900 font-[system-ui,-apple-system]">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            Manager: {username || "Sporty User"}
          </p>
          <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-semibold uppercase tracking-wider">
            Draft Mode
          </span>
        </div>

        <CreateTeamHeader
          leagueName={league.name}
          sport={leagueSport}
          budget={budget}
          remainingBudget={Number(myTeam?.current_budget ?? budget)}
          step={1}
          totalSteps={1}
          selectedCount={draftedPlayers.length}
          requiredCount={requiredPlayers}
        />

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        {status === "setup" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-amber-900">
              Draft Not Started
            </h2>
            <p className="text-sm text-amber-800">
              This is a draft league. Team creation happens only through the
              draft process.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/leagues/${league.id}`)}
              className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Go to League
            </button>
          </div>
        ) : null}

        {status === "drafting" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div
                className={`mb-3 rounded-lg border px-4 py-2 text-sm ${isMyDraftTurn ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}
              >
                {isMyDraftTurn
                  ? "Your turn: choose a player now."
                  : "Waiting for your turn. Player selection is locked."}
              </div>
              <PlayerMarket
                players={marketPlayers}
                onAddPlayer={handleDraftPick}
                onRemovePlayer={() => {}}
                selectedPlayerIds={[]}
                sport={leagueSport}
                remainingBudget={Number(myTeam?.current_budget ?? budget)}
                searchQuery={searchQuery}
                selectedPosition={selectedPosition}
                selectedSport={selectedSport}
                selectedCostFilter={selectedCostFilter}
                onSearchQueryChange={setSearchQuery}
                onPositionChange={setSelectedPosition}
                onSportChange={setSelectedSport}
                onCostFilterChange={setSelectedCostFilter}
                canAddPlayers={isMyDraftTurn}
                addDisabledReason="Waiting for your draft turn"
              />
            </div>
            <div className="lg:col-span-1">
              <CurrentTeam
                players={draftedPlayers}
                onRemovePlayer={() => {}}
                budget={budget}
                totalCost={draftedPlayers.reduce((sum, p) => sum + p.price, 0)}
                requiredPlayers={requiredPlayers}
              />
            </div>
          </div>
        ) : null}

        {status === "active" || status === "completed" ? (
          draftedPlayers.length > 0 ? (
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Final Team
              </h2>
              <CurrentTeam
                players={draftedPlayers}
                onRemovePlayer={() => {}}
                budget={budget}
                totalCost={draftedPlayers.reduce((sum, p) => sum + p.price, 0)}
                requiredPlayers={requiredPlayers}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
              Draft is complete, but your team was not found.
            </div>
          )
        ) : null}

        {playersLoading || makeDraftPickMutation.isPending ? (
          <div className="text-sm text-gray-500">Updating draft board...</div>
        ) : null}
      </section>
    );
  }

  if (myTeam) {
    const canDiscardInSetup = league.status === "setup" && !isDraftLeague;

    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 text-gray-900 font-[system-ui,-apple-system]">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-500">
            Manager: {username || "Sporty User"}
          </p>
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold uppercase tracking-wider">
            Team Ready
          </span>
        </div>

        <CreateTeamHeader
          leagueName={league.name}
          sport={leagueSport}
          budget={budget}
          remainingBudget={Number(myTeam.current_budget ?? 0)}
          step={3}
          totalSteps={3}
          selectedCount={(myTeam.team_players ?? myTeam.players ?? []).length}
          requiredCount={requiredPlayers}
        />

        <CurrentTeam
          players={draftedPlayers}
          onRemovePlayer={
            canDiscardInSetup ? handleDiscardTeamPlayer : () => {}
          }
          budget={budget}
          totalCost={draftedPlayers.reduce((sum, p) => sum + p.price, 0)}
          requiredPlayers={requiredPlayers}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => router.push(`/leagues/${league.id}`)}
            className="rounded-full bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Go to League
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 text-gray-900 font-[system-ui,-apple-system]">
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
        sport={leagueSport}
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

      <section className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Budget used: ${budgetUsed.toFixed(1)} / ${budget.toFixed(1)}
          </span>
          <span
            className={
              remainingBudget >= 0
                ? "text-green-600 font-medium"
                : "text-red-600 font-medium"
            }
          >
            ${remainingBudget.toFixed(1)} left
          </span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
          <div
            className={
              remainingBudget >= 0
                ? "h-2 rounded-full bg-green-500"
                : "h-2 rounded-full bg-red-500"
            }
            style={{ width: `${budgetProgress}%` }}
          />
        </div>
        {isMultiSportLeague ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-green-700">
              ⚽ Football: {selectedCountsBySport.football ?? 0}/
              {MULTISPORT_MIN_BY_SPORT.football} min
            </span>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-orange-700">
              🏀 Basketball: {selectedCountsBySport.basketball ?? 0}/
              {MULTISPORT_MIN_BY_SPORT.basketball} min
            </span>
          </div>
        ) : null}
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleUndoLastPick}
          disabled={pickHistory.length === 0}
          className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Undo Last Pick
        </button>
      </div>

      {step === 1 ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PlayerMarket
                players={filteredMarketPlayers}
                onAddPlayer={handleAddPlayer}
                onRemovePlayer={handleRemovePlayer}
                selectedPlayerIds={selectedPlayerIds}
                sport={leagueSport}
                remainingBudget={remainingBudget}
                searchQuery={searchQuery}
                selectedPosition={selectedPosition}
                selectedSport={selectedSport}
                selectedCostFilter={selectedCostFilter}
                onSearchQueryChange={setSearchQuery}
                onPositionChange={setSelectedPosition}
                onSportChange={setSelectedSport}
                onCostFilterChange={setSelectedCostFilter}
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
              className="rounded-full bg-primary-600 px-10 py-3 font-semibold text-black hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60 shadow-lg transition-all"
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
          onSubmit={handleCreateTeam}
          onBack={() => setStep(1)}
          isSaving={buildTeamMutation.isPending}
        />
      ) : null}
    </section>
  );
}

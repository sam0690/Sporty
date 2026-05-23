"use client";

import { CreateTeamHeader } from "@/components/dashboard/create-team/components/CreateTeamHeader";
import { CurrentTeam } from "@/components/dashboard/create-team/components/CurrentTeam";
import { PlayerMarket } from "@/components/dashboard/create-team/components/PlayerMarket";
import { TeamNameForm } from "@/components/dashboard/create-team/components/TeamNameForm";
import type { MarketPlayer } from "@/components/dashboard/create-team/components/PlayerCard";
import { MULTISPORT_MIN_BY_SPORT } from "../hooks/useCreateTeamDashboard";
import { CardSkeleton } from "@/components/ui/skeletons";

type CreateTeamProps = Record<string, unknown> & { leagueId?: string };

export function CreateTeamView(props: CreateTeamProps = {}) {
  const {
    username,
    router,
    league,
    leagueLoading,
    myTeam,
    leagueSport,
    isMultiSportLeague,
    isDraftLeague,
    playersPage,
    setPlayersPage,
    playersData,
    playersLoading,
    playersPageSize,
    playersTotal,
    playersCurrentPage,
    playersTotalPages,
    isPlayersPageLoading,
    marketPlayers,
    draftedPlayers,
    control,
    setValue,
    trigger,
    handleSubmit,
    errors,
    teamName,
    step,
    setStep,
    selectedPlayers,
    setSelectedPlayers,
    selectedPlayerIds,
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
    marketPlayers,
    isMyDraftTurn,
    handleAddPlayer,
    handleRemovePlayer,
    handleDraftPick,
    handleUndoLastPick,
    handlePreviousPlayersPage,
    handleNextPlayersPage,
    handleDiscardTeamPlayer,
    handleNextStep,
    handleCreateTeam,
    buildTeamMutation,
    makeDraftPickMutation,
    discardTeamPlayerMutation,
    draftTurn,
  } = props as any;

  if (isDraftLeague) {
    const status = league.status;

    return (
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-foreground font-[system-ui,-apple-system,Segoe_UI,Roboto,sans-serif]">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Manager: {username || "Sporty User"}
          </p>
          <span className="rounded-full border border-accent-primary/20 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-primary">
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
          <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {status === "setup" ? (
          <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Draft Not Started
            </h2>
            <p className="text-sm text-slate-300">
              This is a draft league. Team creation happens only through the
              draft process.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/leagues/${league.id}`)}
              className="rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-5 py-2 text-sm font-semibold text-slate-950 hover:brightness-110"
            >
              Go to League
            </button>
          </div>
        ) : null}

        {status === "drafting" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div
                className={`mb-3 rounded-2xl border px-4 py-2 text-sm ${isMyDraftTurn ? "border-accent-primary/20 bg-accent-primary/10 text-accent-primary" : "border-white/10 bg-white/5 text-slate-300"}`}
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
                minCost={minCostInput}
                maxCost={maxCostInput}
                onSearchQueryChange={setSearchQuery}
                onPositionChange={setSelectedPosition}
                onSportChange={setSelectedSport}
                onMinCostChange={setMinCostInput}
                onMaxCostChange={setMaxCostInput}
                canAddPlayers={isMyDraftTurn}
                addDisabledReason="Waiting for your draft turn"
                currentPage={playersCurrentPage}
                totalPages={playersTotalPages}
                totalPlayers={playersTotal}
                hasNext={!!playersData?.has_next}
                isLoadingPage={isPlayersPageLoading}
                onPreviousPage={handlePreviousPlayersPage}
                onNextPage={handleNextPlayersPage}
              />
            </div>
            <div className="lg:col-span-1">
              <CurrentTeam
                players={draftedPlayers}
                onRemovePlayer={() => {}}
                budget={budget}
                totalCost={(draftedPlayers as { price: number }[]).reduce((sum, p) => sum + p.price, 0)}
                requiredPlayers={requiredPlayers}
              />
            </div>
          </div>
        ) : null}

        {status === "active" || status === "completed" ? (
          draftedPlayers.length > 0 ? (
            <div className="space-y-4 rounded-lg border border-accent/20 bg-white p-6">
              <h2 className="text-lg font-semibold text-black">Final Team</h2>
              <CurrentTeam
                players={draftedPlayers}
                onRemovePlayer={() => {}}
                budget={budget}
                totalCost={(draftedPlayers as { price: number }[]).reduce((sum, p) => sum + p.price, 0)}
                requiredPlayers={requiredPlayers}
              />
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              Draft is complete, but your team was not found.
            </div>
          )
        ) : null}

        {playersLoading || makeDraftPickMutation.isPending ? (
          <div className="text-sm text-secondary">Updating draft board...</div>
        ) : null}
      </section>
    );
  }

  if (myTeam) {
    const canDiscardInSetup = league.status === "setup" && !isDraftLeague;

    return (
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-foreground font-[system-ui,-apple-system,Segoe_UI,Roboto,sans-serif]">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Manager: {username || "Sporty User"}
          </p>
          <span className="rounded-full border border-accent-primary/20 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-primary">
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
              totalCost={(draftedPlayers as { price: number }[]).reduce((sum, p) => sum + p.price, 0)}
          requiredPlayers={requiredPlayers}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => router.push(`/leagues/${league.id}`)}
            className="rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-6 py-2.5 text-sm font-semibold text-slate-950 hover:brightness-110"
          >
            Go to League
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-foreground font-[system-ui,-apple-system,Segoe_UI,Roboto,sans-serif]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Manager: {username || "Sporty User"}
        </p>
        <span className="rounded-full border border-accent-primary/20 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-primary">
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
        <p className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>
            Budget used: ${budgetUsed.toFixed(1)} / ${budget.toFixed(1)}
          </span>
          <span
            className={
              remainingBudget >= 0
                ? "font-medium text-accent-primary"
                : "font-medium text-red-400"
            }
          >
            ${remainingBudget.toFixed(1)} left
          </span>
        </div>
        <div className="mt-2 h-2 w-full rounded-full bg-white/8">
          <div
            className={
              remainingBudget >= 0
                ? "h-2 rounded-full bg-linear-to-r from-accent-primary to-accent-secondary"
                : "h-2 rounded-full bg-red-500/60"
            }
            style={{ width: `${budgetProgress}%` }}
          />
        </div>
        {isMultiSportLeague ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-3 py-1 text-accent-primary">
              ⚽ Football: {selectedCountsBySport.football ?? 0}/
              {MULTISPORT_MIN_BY_SPORT.football} min
            </span>
            <span className="rounded-full border border-accent-secondary/20 bg-accent-secondary/10 px-3 py-1 text-accent-secondary">
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
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Undo Last Pick
        </button>
      </div>

      {step === 1 ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <PlayerMarket
                players={marketPlayers}
                onAddPlayer={handleAddPlayer}
                onRemovePlayer={handleRemovePlayer}
                selectedPlayerIds={selectedPlayerIds}
                sport={leagueSport}
                remainingBudget={remainingBudget}
                searchQuery={searchQuery}
                selectedPosition={selectedPosition}
                selectedSport={selectedSport}
                minCost={minCostInput}
                maxCost={maxCostInput}
                onSearchQueryChange={setSearchQuery}
                onPositionChange={setSelectedPosition}
                onSportChange={setSelectedSport}
                onMinCostChange={setMinCostInput}
                onMaxCostChange={setMaxCostInput}
                currentPage={playersCurrentPage}
                totalPages={playersTotalPages}
                totalPlayers={playersTotal}
                hasNext={!!playersData?.has_next}
                isLoadingPage={isPlayersPageLoading}
                onPreviousPage={handlePreviousPlayersPage}
                onNextPage={handleNextPlayersPage}
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
              className="rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-10 py-3 font-semibold text-slate-950 shadow-lg transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Review Team & Name
            </button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <TeamNameForm
          teamName={teamName}
          onTeamNameChange={(value) =>
            setValue("team_name", value, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          onSubmit={handleCreateTeam}
          onBack={() => setStep(1)}
          isSaving={buildTeamMutation.isPending}
          error={errors.team_name?.message ?? null}
        />
      ) : null}
    </section>
  );
}

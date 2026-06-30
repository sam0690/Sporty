"use client";

import { CreateTeamHeader } from "@/components/dashboard/create-team/components/CreateTeamHeader";
import { CurrentTeam } from "@/components/dashboard/create-team/components/CurrentTeam";
import { PlayerMarket } from "@/components/dashboard/create-team/components/PlayerMarket";
import { TeamNameForm } from "@/components/dashboard/create-team/components/TeamNameForm";
import type { MarketPlayer } from "@/components/dashboard/create-team/components/PlayerCard";
import { MULTISPORT_MIN_BY_SPORT } from "../hooks/useCreateTeamDashboard";
import { CardSkeleton } from "@/components/ui/skeletons";

type CreateTeamProps = Record<string, unknown> & { leagueId?: string };
type CreateTeamViewModel = ReturnType<
  typeof import("../hooks/useCreateTeamDashboard").useCreateTeamDashboard
>;

export function CreateTeamView(
  props: CreateTeamProps & Partial<CreateTeamViewModel> = {},
) {
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
    selectedPosition,
    selectedSport,
    minCostInput,
    maxCostInput,
    handleSearchQueryChange,
    handlePositionChange,
    handleSportChange,
    handleMinCostChange,
    handleMaxCostChange,
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
    isAutoPicking,
    isMyDraftTurn,
    handleAddPlayer,
    handleRemovePlayer,
    handleDraftPick,
    handleAutoPickSquad,
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
  } = props as CreateTeamViewModel;

  if (leagueLoading || !league) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8 text-sm text-[#555560]">
        Loading team setup...
      </section>
    );
  }

  if (isDraftLeague) {
    const status = league.status;

    return (
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-[#f0f0f0]">
        <div className="flex items-center justify-between">
          <p className="section-label">Manager: {username || "Sporty User"}</p>
          <span className="rounded-[3px] border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#e8fb25]">
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
          <p className="rounded-[3px] border border-[rgba(255,59,48,0.3)] bg-[rgba(255,59,48,0.08)] px-4 py-2.5 text-sm text-[#ff3b30]">
            {error}
          </p>
        ) : null}

        {status === "setup" ? (
          <div className="space-y-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6">
            <h2 className="font-bebas text-2xl tracking-[1px] text-[#f0f0f0]">
              Draft Not Started
            </h2>
            <p className="text-sm text-[#9a9aa5]">
              This is a draft league. Team creation happens only through the
              draft process.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/leagues/${league.id}`)}
              className="rounded-[3px] bg-[#e8fb25] px-5 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-[#f2ff5a]"
            >
              Go to League
            </button>
          </div>
        ) : null}

        {status === "drafting" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div
                className={`mb-3 rounded-[3px] border px-4 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1px] ${isMyDraftTurn ? "border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]" : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#9a9aa5]"}`}
              >
                {isMyDraftTurn
                  ? "Your turn — choose a player now."
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
                onSearchQueryChange={handleSearchQueryChange}
                onPositionChange={handlePositionChange}
                onSportChange={handleSportChange}
                onMinCostChange={handleMinCostChange}
                onMaxCostChange={handleMaxCostChange}
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
                totalCost={(draftedPlayers as { price: number }[]).reduce(
                  (sum, p) => sum + p.price,
                  0,
                )}
                requiredPlayers={requiredPlayers}
              />
            </div>
          </div>
        ) : null}

        {status === "active" || status === "completed" ? (
          draftedPlayers.length > 0 ? (
            <div className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6">
              <p className="section-label">Final Team</p>
              <CurrentTeam
                players={draftedPlayers}
                onRemovePlayer={() => {}}
                budget={budget}
                totalCost={(draftedPlayers as { price: number }[]).reduce(
                  (sum, p) => sum + p.price,
                  0,
                )}
                requiredPlayers={requiredPlayers}
              />
            </div>
          ) : (
            <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-6 text-sm text-[#9a9aa5]">
              Draft is complete, but your team was not found.
            </div>
          )
        ) : null}

        {playersLoading || makeDraftPickMutation.isPending ? (
          <p className="section-label">Updating draft board…</p>
        ) : null}
      </section>
    );
  }

  if (myTeam) {
    const canDiscardInSetup = league.status === "setup" && !isDraftLeague;

    return (
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-[#f0f0f0]">
        <div className="flex items-center justify-between">
          <p className="section-label">Manager: {username || "Sporty User"}</p>
          <span className="rounded-[3px] border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#e8fb25]">
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
          totalCost={(draftedPlayers as { price: number }[]).reduce(
            (sum, p) => sum + p.price,
            0,
          )}
          requiredPlayers={requiredPlayers}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => router.push(`/leagues/${league.id}`)}
            className="rounded-[3px] bg-[#e8fb25] px-6 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-[#f2ff5a]"
          >
            Go to League
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-[#f0f0f0]">
      <div className="flex items-center justify-between">
        <p className="section-label">Manager: {username || "Sporty User"}</p>
        <span className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5]">
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
        <p className="rounded-[3px] border border-[rgba(255,59,48,0.3)] bg-[rgba(255,59,48,0.08)] px-4 py-2.5 text-sm text-[#ff3b30]">
          {error}
        </p>
      ) : null}

      <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-4">
        <div className="flex items-center justify-between">
          <span className="section-label">
            Budget used ${budgetUsed.toFixed(1)} / ${budget.toFixed(1)}
          </span>
          <span
            className={`font-bebas text-lg leading-none tracking-[1px] tabular-nums ${
              remainingBudget >= 0 ? "text-[#e8fb25]" : "text-[#ff3b30]"
            }`}
          >
            ${remainingBudget.toFixed(1)} left
          </span>
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-[3px] bg-[#0d0d12]">
          <div
            className={`h-2 rounded-[3px] transition-[width] duration-300 ${
              remainingBudget >= 0 ? "bg-[#e8fb25]" : "bg-[#ff3b30]"
            }`}
            style={{ width: `${budgetProgress}%` }}
          />
        </div>
        {isMultiSportLeague ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-[3px] sport-badge-football px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1px]">
              Football {selectedCountsBySport.football ?? 0}/
              {MULTISPORT_MIN_BY_SPORT.football} min
            </span>
            <span className="rounded-[3px] sport-badge-basketball px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1px]">
              Basketball {selectedCountsBySport.basketball ?? 0}/
              {MULTISPORT_MIN_BY_SPORT.basketball} min
            </span>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={handleAutoPickSquad}
          disabled={isAutoPicking}
          className="rounded-[3px] border border-[rgba(232,251,37,0.35)] bg-[rgba(232,251,37,0.1)] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#e8fb25] transition-colors hover:bg-[rgba(232,251,37,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAutoPicking ? "Auto Picking…" : "Auto Pick Squad"}
        </button>
        <button
          type="button"
          onClick={handleUndoLastPick}
          disabled={pickHistory.length === 0 || isAutoPicking}
          className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5] transition-colors hover:text-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-50"
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
                onSearchQueryChange={handleSearchQueryChange}
                onPositionChange={handlePositionChange}
                onSportChange={handleSportChange}
                onMinCostChange={handleMinCostChange}
                onMaxCostChange={handleMaxCostChange}
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
              disabled={selectedPlayers.length !== requiredPlayers}
              className="rounded-[3px] bg-[#e8fb25] px-10 py-3 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-[#f2ff5a] disabled:cursor-not-allowed disabled:bg-[#1d1d26] disabled:text-[#555560]"
            >
              Review Team &amp; Name
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

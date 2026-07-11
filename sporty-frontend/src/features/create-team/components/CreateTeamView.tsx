"use client";

import { CreateTeamHeader } from "@/components/dashboard/create-team/components/CreateTeamHeader";
import { GameweekEntryNotice } from "@/components/dashboard/create-team/components/GameweekEntryNotice";
import { CurrentTeam } from "@/components/dashboard/create-team/components/CurrentTeam";
import { PlayerMarket } from "@/components/dashboard/create-team/components/PlayerMarket";
import { TeamNameForm } from "@/components/dashboard/create-team/components/TeamNameForm";
import { SquadValidationChecklist } from "@/components/dashboard/create-team/components/SquadValidationChecklist";
import { MULTISPORT_MIN_BY_SPORT } from "../hooks/useCreateTeamDashboard";

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
    activeWindow,
    editableWindow,
    playersData,
    playersLoading,
    playersTotal,
    playersCurrentPage,
    playersTotalPages,
    isPlayersPageLoading,
    marketPlayers,
    draftedPlayers,
    setValue,
    errors,
    teamName,
    step,
    setStep,
    selectedPlayers,
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
    pickHistory,
    selectedCountsBySport,
    totalCost,
    budget,
    requiredPlayers,
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
    handleGoToLineup,
    squadValidation,
    clubCounts,
    isRosterComplete,
    isDraftComplete,
    buildTeamMutation,
    makeDraftPickMutation,
  } = props as CreateTeamViewModel;

  if (leagueLoading || !league) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8 text-sm text-fg-3">
        Loading team setup...
      </section>
    );
  }

  if (isDraftLeague) {
    const status = league.status;

    return (
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-fg-1">
        <div className="flex items-center justify-between">
          <p className="section-label">Manager: {username || "Sporty User"}</p>
          <span className="rounded-[3px] border border-accent/30 bg-accent/10 px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-accent">
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
          showBudget={false}
        />

        {error ? (
          <p className="rounded-[3px] border border-[rgba(255,59,48,0.3)] bg-[rgba(255,59,48,0.08)] px-4 py-2.5 text-sm text-[#ff3b30]">
            {error}
          </p>
        ) : null}

        {status === "setup" ? (
          <div className="space-y-3 rounded-[3px] border border-white/8 bg-surface-1 p-6">
            <h2 className="font-bebas text-2xl tracking-[1px] text-fg-1">
              Draft Not Started
            </h2>
            <p className="text-sm text-fg-2">
              This is a draft league. Team creation happens only through the
              draft process.
            </p>
            <button
              type="button"
              onClick={() => router.push(`/leagues/${league.id}`)}
              className="rounded-[3px] bg-accent px-5 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright"
            >
              Go to League
            </button>
          </div>
        ) : null}

        {status === "drafting" ? (
          isRosterComplete || isDraftComplete ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 rounded-[3px] border border-[rgba(76,175,80,0.3)] bg-[#131a13] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="section-label text-[#4caf50]">
                    Draft Complete
                  </span>
                  <p className="mt-1 text-sm text-fg-2">
                    Your squad is set. Head to the lineup to pick your starters
                    and captain.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGoToLineup}
                  className="shrink-0 rounded-[3px] bg-accent px-6 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright"
                >
                  Set Lineup
                </button>
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
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
                <div className="lg:col-span-1">
                  <SquadValidationChecklist rules={squadValidation} clubWarnings={clubCounts} />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div
                  className={`mb-3 rounded-[3px] border px-4 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1px] ${isMyDraftTurn ? "border-accent/30 bg-accent/10 text-accent" : "border-white/8 bg-surface-3 text-fg-2"}`}
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
              <div className="space-y-6 lg:col-span-1">
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
                <SquadValidationChecklist rules={squadValidation} clubWarnings={clubCounts} />
              </div>
            </div>
          )
        ) : null}

        {status === "active" || status === "completed" ? (
          draftedPlayers.length > 0 ? (
            <div className="space-y-4 rounded-[3px] border border-white/8 bg-surface-1 p-6">
              <GameweekEntryNotice
                activeWindow={activeWindow}
                editableWindow={editableWindow}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="section-label">Final Team</p>
                <button
                  type="button"
                  onClick={handleGoToLineup}
                  className="rounded-[3px] bg-accent px-6 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright"
                >
                  Set Lineup
                </button>
              </div>
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
            <div className="rounded-[3px] border border-white/8 bg-surface-1 p-6 text-sm text-fg-2">
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
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-fg-1">
        <div className="flex items-center justify-between">
          <p className="section-label">Manager: {username || "Sporty User"}</p>
          <span className="rounded-[3px] border border-accent/30 bg-accent/10 px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-accent">
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
          showBudget={!isDraftLeague}
        />

        <GameweekEntryNotice
          activeWindow={activeWindow}
          editableWindow={editableWindow}
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
            className="rounded-[3px] bg-accent px-6 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright"
          >
            Go to League
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-fg-1">
      <div className="flex items-center justify-between">
        <p className="section-label">Manager: {username || "Sporty User"}</p>
        <span className="rounded-[3px] border border-white/8 bg-surface-3 px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-fg-2">
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

      <section className="rounded-[3px] border border-white/8 bg-surface-1 p-4">
        <div className="flex items-center justify-between">
          <span className="section-label">
            Budget used ${budgetUsed.toFixed(1)}M / ${budget.toFixed(1)}M
          </span>
          <span
            className={`font-bebas text-lg leading-none tracking-[1px] tabular-nums ${
              remainingBudget >= 0 ? "text-accent" : "text-[#ff3b30]"
            }`}
          >
            ${remainingBudget.toFixed(1)}M left
          </span>
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-[3px] bg-surface-2">
          <div
            className={`h-2 rounded-[3px] transition-[width] duration-300 ${
              remainingBudget >= 0 ? "bg-accent" : "bg-[#ff3b30]"
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
          className="rounded-[3px] border border-accent/35 bg-accent/10 px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-accent transition-colors hover:bg-accent/18 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isAutoPicking ? "Auto Picking…" : "Auto Pick Squad"}
        </button>
        <button
          type="button"
          onClick={handleUndoLastPick}
          disabled={pickHistory.length === 0 || isAutoPicking}
          className="rounded-[3px] border border-white/8 bg-surface-3 px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-fg-2 transition-colors hover:text-fg-1 disabled:cursor-not-allowed disabled:opacity-50"
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

            <div className="space-y-6 lg:col-span-1">
              <CurrentTeam
                players={selectedPlayers}
                onRemovePlayer={handleRemovePlayer}
                budget={budget}
                totalCost={totalCost}
                requiredPlayers={requiredPlayers}
              />
              <SquadValidationChecklist rules={squadValidation} clubWarnings={clubCounts} />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={handleNextStep}
              disabled={selectedPlayers.length !== requiredPlayers}
              className="rounded-[3px] bg-accent px-10 py-3 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3"
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

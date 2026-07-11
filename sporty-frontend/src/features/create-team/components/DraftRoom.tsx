"use client";

import { CreateTeamHeader } from "./CreateTeamHeader";
import { CurrentTeam } from "./CurrentTeam";
import { GameweekEntryNotice } from "./GameweekEntryNotice";
import { PlayerMarket } from "./PlayerMarket";
import { SquadValidationChecklist } from "./SquadValidationChecklist";
import type { CreateTeamViewModel } from "../hooks/useCreateTeamDashboard";

type DraftRoomProps = Omit<CreateTeamViewModel, "league"> & {
  league: NonNullable<CreateTeamViewModel["league"]>;
};

export function DraftRoom({
  username,
  router,
  league,
  myTeam,
  leagueSport,
  budget,
  requiredPlayers,
  error,
  draftedPlayers,
  squadValidation,
  clubCounts,
  isRosterComplete,
  isDraftComplete,
  isMyDraftTurn,
  handleGoToLineup,
  marketPlayers,
  handleDraftPick,
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
  playersCurrentPage,
  playersTotalPages,
  playersTotal,
  playersData,
  isPlayersPageLoading,
  handlePreviousPlayersPage,
  handleNextPlayersPage,
  playersLoading,
  makeDraftPickMutation,
  activeWindow,
  editableWindow,
}: DraftRoomProps) {
  const status = league.status;

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-fg-1">
      <div className="flex items-center justify-between">
        <p className="section-label">Manager: {username || "Sporty User"}</p>
        <span className="rounded-[3px] border border-accent/30 bg-accent/10 px-3 py-1 font-sans text-xs font-700 uppercase tracking-[1.5px] text-accent">
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
        <p className="rounded-[3px] border border-[rgba(255,59,48,0.3)] bg-[rgba(255,59,48,0.08)] px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {status === "setup" ? (
        <div className="space-y-3 card-surface p-6">
          <h2 className="font-display text-2xl tracking-[-0.02em] text-fg-1">
            Draft Not Started
          </h2>
          <p className="text-sm text-fg-2">
            This is a draft league. Team creation happens only through the
            draft process.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/leagues/${league.id}`)}
            className="rounded-[3px] bg-accent px-5 py-2.5 font-sans text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright"
          >
            Go to League
          </button>
        </div>
      ) : null}

      {status === "drafting" ? (
        isRosterComplete || isDraftComplete ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-[3px] border border-success/30 bg-success/8 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="section-label text-success">
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
                className="shrink-0 rounded-[3px] bg-accent px-6 py-2.5 font-sans text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright"
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
                className={`mb-3 rounded-[3px] border px-4 py-2.5 font-sans text-sm font-700 uppercase tracking-[1px] ${isMyDraftTurn ? "border-accent/30 bg-accent/10 text-accent" : "border-white/8 bg-surface-3 text-fg-2"}`}
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
          <div className="space-y-4 card-surface p-6">
            <GameweekEntryNotice
              activeWindow={activeWindow}
              editableWindow={editableWindow}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="section-label">Final Team</p>
              <button
                type="button"
                onClick={handleGoToLineup}
                className="rounded-[3px] bg-accent px-6 py-2.5 font-sans text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright"
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
          <div className="card-surface p-6 text-sm text-fg-2">
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

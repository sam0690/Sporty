"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { BudgetOverageConfirmation } from "@/components/dashboard/transfers/components/BudgetOverageConfirmation";
import { CurrentRoster } from "@/components/dashboard/transfers/components/CurrentRoster";
import { FilterBar } from "@/components/dashboard/transfers/components/FilterBar";
import { PlayerCard } from "@/components/dashboard/transfers/components/PlayerCard";
import { SearchBar } from "@/components/dashboard/transfers/components/SearchBar";
import { TransferConfirmation } from "@/components/dashboard/transfers/components/TransferConfirmation";
import { TransfersHeader } from "@/components/dashboard/transfers/components/TransfersHeader";
import { TransferSuccess } from "@/components/dashboard/transfers/components/TransferSuccess";
import { UserTransferHistoryCarousel } from "@/components/dashboard/transfers/components/UserTransferHistoryCarousel";
import { SquadValidationChecklist } from "@/components/dashboard/create-team/components/SquadValidationChecklist";
import { GameweekContextBar } from "@/components/dashboard/leagues/GameweekContextBar";
import { EmptyTransfers } from "@/components/ui/empty-states";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";
import type { Sport } from "@/components/dashboard/transfers/components/FilterBar";
import type { OwnedPlayer } from "@/components/dashboard/transfers/components/CurrentRoster";

type Props = ReturnType<
  typeof import("../hooks/useTransfersDashboard").useTransfersDashboard
>;

export function TransfersView(props: Props) {
  const {
    username,
    leagueId,
    league,
    userTransferGroups,
    userTransfersLoading,
    userTransfersError,
    activeWindow,
    liveWindow,
    playersCurrentPage,
    playersTotalPages,
    playersTotal,
    isPlayersPageLoading,
    isLoading,
    budget,
    transfersRemaining,
    stagedOutPlayers,
    stagedInPlayers,
    selectedOutPlayer,
    visibleOwnedPlayers,
    availablePlayers,
    availableSportsForFilter,
    positionOptionsBySport,
    isTransfersOpen,
    isMultiSportLeague,
    positionValidation,
    clubCounts,
    selectedSport,
    selectedPosition,
    searchQuery,
    minCostInput,
    maxCostInput,
    showConfirmModal,
    setShowConfirmModal,
    budgetOverage,
    confirmPayWithPoints,
    dismissBudgetOverage,
    handlePreviousPlayersPage,
    handleNextPlayersPage,
    handleSearchChange,
    handleSportChange,
    handlePositionChange,
    handleMinCostChange,
    handleMaxCostChange,
    handleAddPlayer,
    handleStageOut,
    confirmAllTransfers,
    clearAllFilters,
    cancelTransfersMutation,
    confirmTransfersMutation,
    toastState,
  } = props;

  if (!leagueId) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8 text-[#f0f0f0]">
        <p className="mb-6 section-label">Manager: {username || "Sporty User"}</p>
        <div className="mb-6 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-8 text-center">
          <p className="text-2xl" aria-hidden>
            🔄
          </p>
          <h2 className="mt-2 font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-[#f0f0f0]">
            Select a league to manage transfers
          </h2>
          <p className="mt-1 text-sm text-[#555560]">
            Your transfer history is still available below.
          </p>
        </div>

        <UserTransferHistoryCarousel
          groups={userTransferGroups ?? []}
          isLoading={userTransfersLoading}
          isError={Boolean(userTransfersError)}
        />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-8 text-[#f0f0f0]">
      <p className="mb-6 section-label">Manager: {username || "Sporty User"}</p>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <TransfersHeader
            budget={budget}
            leagueName={league?.name || "Loading..."}
            currentWeek={activeWindow?.number || 0}
          />
          <GameweekContextBar
            leagueId={leagueId}
            editableWindow={activeWindow}
            activeWindow={liveWindow}
            deadlineField="transfer_deadline_at"
          />
          {transfersRemaining !== null ? (
            <div className="rounded-[3px] border border-[rgba(232,251,37,0.2)] bg-[rgba(232,251,37,0.08)] px-4 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#e8fb25]">
              {transfersRemaining} transfers remaining this session
            </div>
          ) : null}
          <SquadValidationChecklist
            title="Squad Rules"
            rules={positionValidation}
            clubWarnings={clubCounts}
          />
          {stagedOutPlayers.length > 0 || stagedInPlayers.length > 0 ? (
            <div className="overflow-hidden rounded-[3px] border border-[rgba(232,251,37,0.2)] bg-[#111117]">
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
                <p className="section-label">Staged Transfers</p>
                <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#555560]">
                  {stagedOutPlayers.length} out · {stagedInPlayers.length} in
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#ff3b30]">
                    ▼ Out
                  </p>
                  <div className="space-y-1">
                    {stagedOutPlayers.length === 0 ? (
                      <p className="text-xs text-[#555560]">—</p>
                    ) : (
                      stagedOutPlayers.map((player) => (
                        <p
                          key={player.id}
                          className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]"
                        >
                          {player.name}
                        </p>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-2 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#4caf50]">
                    ▲ In
                  </p>
                  <div className="space-y-1">
                    {stagedInPlayers.length === 0 ? (
                      <p className="text-xs text-[#555560]">—</p>
                    ) : (
                      stagedInPlayers.map((player) => (
                        <p
                          key={player.id}
                          className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]"
                        >
                          {player.name}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="px-4 pb-4">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={
                    confirmTransfersMutation.isPending ||
                    (stagedOutPlayers.length === 0 &&
                      stagedInPlayers.length === 0) ||
                    (!isMultiSportLeague &&
                      stagedOutPlayers.length !== stagedInPlayers.length) ||
                    !isTransfersOpen
                  }
                  className="w-full rounded-[3px] bg-[#e8fb25] px-4 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#0a0a0f] transition-colors hover:bg-[#f0ff45] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmTransfersMutation.isPending
                    ? "Confirming…"
                    : "Confirm Staged Transfers"}
                </button>
                {isMultiSportLeague ? (
                  <p className="mt-2 text-xs text-[#555560]">
                    Multisport: you can stage players in directly when budget and
                    roster limits allow.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          <SearchBar value={searchQuery} onSearch={handleSearchChange} />

          <FilterBar
            selectedSport={selectedSport as Sport}
            selectedPosition={selectedPosition}
            minCost={minCostInput}
            maxCost={maxCostInput}
            availableSports={availableSportsForFilter}
            positionOptionsBySport={positionOptionsBySport}
            onSportChange={handleSportChange}
            onPositionChange={handlePositionChange}
            onMinCostChange={handleMinCostChange}
            onMaxCostChange={handleMaxCostChange}
          />

          <div className="flex flex-col gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-[#555560]">
              <span className="font-barlow-condensed font-700 uppercase tracking-[1px] text-[#f0f0f0]">
                Page {playersCurrentPage}
              </span>
              <span>/ {playersTotalPages}</span>
              <span className="hidden sm:inline">•</span>
              <span>{playersTotal} players</span>
              {isPlayersPageLoading ? (
                <span className="inline-flex items-center gap-1 rounded-[3px] bg-[rgba(232,251,37,0.1)] px-2.5 py-1 text-xs text-[#e8fb25]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePreviousPlayersPage}
                disabled={playersCurrentPage <= 1 || isPlayersPageLoading}
                className="inline-flex items-center gap-1 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3.5 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5] transition-colors hover:text-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                type="button"
                onClick={handleNextPlayersPage}
                disabled={!playersTotalPages || isPlayersPageLoading}
                className="inline-flex items-center gap-1 rounded-[3px] bg-[#e8fb25] px-3.5 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#0a0a0f] transition-colors hover:bg-[#f0ff45] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {isLoading ||
            (isPlayersPageLoading && visibleOwnedPlayers.length === 0) ? (
              Array.from({ length: 5 }, (_, index) => (
                <PlayerCardSkeleton key={index} />
              ))
            ) : availablePlayers.length === 0 ? (
              <EmptyTransfers onClearFilters={clearAllFilters} />
            ) : (
              availablePlayers.map((player, index) => (
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
                  disabled={!isTransfersOpen}
                />
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <CurrentRoster
            players={visibleOwnedPlayers as OwnedPlayer[]}
            onDrop={handleStageOut}
            budget={budget}
            maxPlayers={league?.squad_size || 15}
            selectedOutId={selectedOutPlayer?.id}
            disabled={!isTransfersOpen}
          />
          {selectedOutPlayer && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[3px] border border-[rgba(232,251,37,0.25)] bg-[rgba(232,251,37,0.08)] px-4 py-3">
              <div className="min-w-0">
                <p className="section-label">Swapping Out</p>
                <p className="mt-0.5 truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#f0f0f0]">
                  {selectedOutPlayer.name}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await cancelTransfersMutation.mutateAsync();
                  } catch {}
                }}
                className="shrink-0 text-[#555560] transition-colors hover:text-[#f0f0f0]"
                aria-label="Cancel swap"
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
                  setShowConfirmModal(false);
                } catch {}
              }}
              className="mt-3 w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5] transition-colors hover:text-[#f0f0f0]"
            >
              Cancel Staged Session
            </button>
          ) : null}
        </div>
      </div>

      <TransferConfirmation
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => void confirmAllTransfers()}
        isLoading={confirmTransfersMutation.isPending}
        allowUnpaired={isMultiSportLeague}
        stagedOutPlayers={stagedOutPlayers}
        stagedInPlayers={stagedInPlayers}
        transfersOpen={isTransfersOpen}
        transferDeadlineAt={activeWindow?.transfer_deadline_at}
      />

      <BudgetOverageConfirmation
        detail={budgetOverage}
        onConfirm={confirmPayWithPoints}
        onCancel={dismissBudgetOverage}
        isLoading={confirmTransfersMutation.isPending}
      />

      <TransferSuccess
        status={toastState?.status}
        message={toastState?.message}
        token={toastState?.token}
      />

      <div className="mt-8">
        <UserTransferHistoryCarousel
          groups={userTransferGroups ?? []}
          isLoading={userTransfersLoading}
          isError={Boolean(userTransfersError)}
        />
      </div>
    </section>
  );
}

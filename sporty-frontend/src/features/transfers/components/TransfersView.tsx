"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { CurrentRoster } from "@/components/dashboard/transfers/components/CurrentRoster";
import { FilterBar } from "@/components/dashboard/transfers/components/FilterBar";
import { PlayerCard } from "@/components/dashboard/transfers/components/PlayerCard";
import { SearchBar } from "@/components/dashboard/transfers/components/SearchBar";
import { TransferConfirmation } from "@/components/dashboard/transfers/components/TransferConfirmation";
import { TransfersHeader } from "@/components/dashboard/transfers/components/TransfersHeader";
import { TransferSuccess } from "@/components/dashboard/transfers/components/TransferSuccess";
import { UserTransferHistoryCarousel } from "@/components/dashboard/transfers/components/UserTransferHistoryCarousel";
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
    selectedSport,
    selectedPosition,
    searchQuery,
    minCostInput,
    maxCostInput,
    showConfirmModal,
    setShowConfirmModal,
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
        <div className="mb-6 text-sm text-[#555560]">
          Manager: {username || "Sporty User"}
        </div>
        <div className="mb-6 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-6 text-center ">
          <h2 className="text-xl font-600 text-[#f0f0f0]">
            Select a league to manage transfers.
          </h2>
          <p className="mt-2 text-sm text-[#555560]">
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
    <section className="mx-auto max-w-7xl px-6 py-8 font-[system-ui,-apple-system,Segoe_UI,Roboto,sans-serif] text-[#f0f0f0]">
      <div className="mb-6 text-sm text-[#555560]">
        Manager: {username || "Sporty User"}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <TransfersHeader
            budget={budget}
            leagueName={league?.name || "Loading..."}
            currentWeek={activeWindow?.number || 0}
          />
          {transfersRemaining !== null ? (
            <div className="rounded-[3px] border border-accent-primary/20 bg-[rgba(232,251,37,0.1)] px-4 py-2 text-sm text-[#e8fb25]">
              Transfers remaining in session: {transfersRemaining}
            </div>
          ) : null}
          {stagedOutPlayers.length > 0 || stagedInPlayers.length > 0 ? (
            <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 text-sm ">
              <p className="font-medium text-[#f0f0f0]">Staged Transfers</p>
              <p className="mt-1 text-[#555560]">
                Out: {stagedOutPlayers.length} | In: {stagedInPlayers.length}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-600 uppercase text-[#555560]">
                    Out
                  </p>
                  {stagedOutPlayers.map((player) => (
                    <p
                      key={player.id}
                      className="truncate text-xs text-[#f0f0f0]"
                    >
                      {player.name}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-600 uppercase text-[#555560]">
                    In
                  </p>
                  {stagedInPlayers.map((player) => (
                    <p
                      key={player.id}
                      className="truncate text-xs text-[#f0f0f0]"
                    >
                      {player.name}
                    </p>
                  ))}
                </div>
              </div>
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
                className="mt-3 w-full rounded-full bg-[#e8fb25] px-4 py-2 text-sm font-600 text-[#0a0a0f] disabled:opacity-50"
              >
                {confirmTransfersMutation.isPending
                  ? "Confirming..."
                  : "Confirm All Staged Transfers"}
              </button>
              {isMultiSportLeague ? (
                <p className="mt-2 text-xs text-[#555560]">
                  Multisport: you can stage players in directly when budget and
                  roster limits allow.
                </p>
              ) : null}
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

          <div className="flex flex-col gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-[#555560]">
              <span className="font-600 text-[#f0f0f0]">
                Page {playersCurrentPage}
              </span>
              <span>/ {playersTotalPages}</span>
              <span className="hidden sm:inline">•</span>
              <span>{playersTotal} players total</span>
              {isPlayersPageLoading ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(232,251,37,0.1)] px-2.5 py-1 text-xs font-medium text-[#e8fb25]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
                  players...
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePreviousPlayersPage}
                disabled={playersCurrentPage <= 1 || isPlayersPageLoading}
                className="inline-flex items-center gap-1 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 text-sm font-medium text-[#f0f0f0] transition-colors hover:bg-[#1d1d26] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <button
                type="button"
                onClick={handleNextPlayersPage}
                disabled={!playersTotalPages || isPlayersPageLoading}
                className="inline-flex items-center gap-1 rounded-full bg-[#e8fb25] px-4 py-2 text-sm font-600 text-[#0a0a0f] transition-colors  disabled:cursor-not-allowed disabled:opacity-50"
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
            <div className="mt-4 flex items-center justify-between rounded-[3px] border border-accent-primary/20 bg-[rgba(232,251,37,0.1)] p-4 animate-in fade-in slide-in-from-top-2">
              <div>
                <p className="text-xs font-700 uppercase text-[#e8fb25]">
                  Player to swap out
                </p>
                <p className="font-600 text-[#f0f0f0]">
                  {selectedOutPlayer.name}
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await cancelTransfersMutation.mutateAsync();
                  } catch {}
                }}
                className="text-[#555560] hover:text-[#f0f0f0]"
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
              className="mt-3 w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 text-sm font-medium text-[#f0f0f0] hover:bg-[#1d1d26]"
            >
              Cancel Staged Session
            </button>
          ) : null}
        </div>
      </div>

      <TransferConfirmation
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmAllTransfers}
        isLoading={confirmTransfersMutation.isPending}
        allowUnpaired={isMultiSportLeague}
        stagedOutPlayers={stagedOutPlayers}
        stagedInPlayers={stagedInPlayers}
        transfersOpen={isTransfersOpen}
        transferDeadlineAt={activeWindow?.transfer_deadline_at}
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

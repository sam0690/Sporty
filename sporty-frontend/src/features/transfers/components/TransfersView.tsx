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

type Props = ReturnType<typeof import("../hooks/useTransfersDashboard").useTransfersDashboard>;

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
      <div className="mx-auto max-w-7xl px-6 py-8 text-foreground">
        <div className="mb-6 text-sm text-slate-400">Manager: {username || "Sporty User"}</div>
        <div className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-xl">
          <h2 className="text-xl font-semibold text-foreground">Select a league to manage transfers.</h2>
          <p className="mt-2 text-sm text-slate-400">Your transfer history is still available below.</p>
        </div>

        <UserTransferHistoryCarousel groups={userTransferGroups ?? []} isLoading={userTransfersLoading} isError={Boolean(userTransfersError)} />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-8 font-[system-ui,-apple-system,Segoe_UI,Roboto,sans-serif] text-foreground">
      <div className="mb-6 text-sm text-slate-400">Manager: {username || "Sporty User"}</div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <TransfersHeader budget={budget} leagueName={league?.name || "Loading..."} currentWeek={activeWindow?.number || 0} />
          {transfersRemaining !== null ? (
            <div className="rounded-3xl border border-accent-primary/20 bg-accent-primary/10 px-4 py-2 text-sm text-accent-primary">Transfers remaining in session: {transfersRemaining}</div>
          ) : null}
          {stagedOutPlayers.length > 0 || stagedInPlayers.length > 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm backdrop-blur-xl">
              <p className="font-medium text-foreground">Staged Transfers</p>
              <p className="mt-1 text-slate-400">Out: {stagedOutPlayers.length} | In: {stagedInPlayers.length}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Out</p>
                  {stagedOutPlayers.map((player) => (
                    <p key={player.id} className="truncate text-xs text-foreground">{player.name}</p>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">In</p>
                  {stagedInPlayers.map((player) => (
                    <p key={player.id} className="truncate text-xs text-foreground">{player.name}</p>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setShowConfirmModal(true)} disabled={confirmTransfersMutation.isPending || (stagedOutPlayers.length === 0 && stagedInPlayers.length === 0) || (!isMultiSportLeague && stagedOutPlayers.length !== stagedInPlayers.length) || !isTransfersOpen} className="mt-3 w-full rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
                {confirmTransfersMutation.isPending ? "Confirming..." : "Confirm All Staged Transfers"}
              </button>
              {isMultiSportLeague ? <p className="mt-2 text-xs text-slate-400">Multisport: you can stage players in directly when budget and roster limits allow.</p> : null}
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

          <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span className="font-semibold text-foreground">Page {playersCurrentPage}</span>
              <span>/ {playersTotalPages}</span>
              <span className="hidden sm:inline">•</span>
              <span>{playersTotal} players total</span>
              {isPlayersPageLoading ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-primary/10 px-2.5 py-1 text-xs font-medium text-accent-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading players...</span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={handlePreviousPlayersPage} disabled={playersCurrentPage <= 1 || isPlayersPageLoading} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"><ChevronLeft className="h-4 w-4" /> Previous</button>
              <button type="button" onClick={handleNextPlayersPage} disabled={!playersTotalPages || isPlayersPageLoading} className="inline-flex items-center gap-1 rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">Next <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="space-y-3">
            {isLoading || (isPlayersPageLoading && visibleOwnedPlayers.length === 0) ? (
              Array.from({ length: 5 }, (_, index) => <PlayerCardSkeleton key={index} />)
            ) : availablePlayers.length === 0 ? (
              <EmptyTransfers onClearFilters={clearAllFilters} />
            ) : (
              availablePlayers.map((player, index) => (
                <PlayerCard key={player.id} id={player.id} name={player.name} sport={player.sport} position={player.position} price={player.price} avgPoints={player.avgPoints} form={player.form} onAdd={handleAddPlayer} animationDelay={index * 60} disabled={!isTransfersOpen} />
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <CurrentRoster players={visibleOwnedPlayers as OwnedPlayer[]} onDrop={handleStageOut} budget={budget} maxPlayers={league?.squad_size || 15} selectedOutId={selectedOutPlayer?.id} disabled={!isTransfersOpen} />
          {selectedOutPlayer && (
            <div className="mt-4 flex items-center justify-between rounded-3xl border border-accent-primary/20 bg-accent-primary/10 p-4 animate-in fade-in slide-in-from-top-2">
              <div>
                <p className="text-xs font-bold uppercase text-accent-primary">Player to swap out</p>
                <p className="font-semibold text-foreground">{selectedOutPlayer.name}</p>
              </div>
              <button onClick={async () => { try { await cancelTransfersMutation.mutateAsync(); } catch { } }} className="text-slate-400 hover:text-foreground">✕</button>
            </div>
          )}
          {selectedOutPlayer ? (
            <button type="button" onClick={async () => { try { await cancelTransfersMutation.mutateAsync(); setShowConfirmModal(false); } catch { } }} className="mt-3 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/8">Cancel Staged Session</button>
          ) : null}
        </div>
      </div>

      <TransferConfirmation isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} onConfirm={confirmAllTransfers} isLoading={confirmTransfersMutation.isPending} allowUnpaired={isMultiSportLeague} stagedOutPlayers={stagedOutPlayers} stagedInPlayers={stagedInPlayers} transfersOpen={isTransfersOpen} transferDeadlineAt={activeWindow?.transfer_deadline_at} />

      <TransferSuccess status={toastState?.status} message={toastState?.message} token={toastState?.token} />

      <div className="mt-8">
        <UserTransferHistoryCarousel groups={userTransferGroups ?? []} isLoading={userTransfersLoading} isError={Boolean(userTransfersError)} />
      </div>
    </section>
  );
}

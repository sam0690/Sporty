"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import { PlayerListCard } from "@/components/ui";
import { BudgetOverageConfirmation } from "./BudgetOverageConfirmation";
import { CurrentRoster } from "./CurrentRoster";
import { FilterBar } from "./FilterBar";
import { PlayerCard } from "./PlayerCard";
import { SearchBar } from "./SearchBar";
import { TransferConfirmation } from "./TransferConfirmation";
import { TransfersHeader } from "./TransfersHeader";
import { TransferSuccess } from "./TransferSuccess";
import { UserTransferHistoryCarousel } from "./UserTransferHistoryCarousel";
import { SquadValidationChecklist } from "@/features/create-team/components/SquadValidationChecklist";
import { GameweekContextBar } from "@/features/leagues/components/GameweekContextBar";
import { EmptyState } from "@/components/ui";
import { SearchX } from "lucide-react";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";
import type { Sport } from "./FilterBar";
import type { OwnedPlayer } from "./CurrentRoster";

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
    isSquadValid,
    unmetRule,
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
    cancelStagedSession,
    confirmAllTransfers,
    clearAllFilters,
    confirmTransfersMutation,
    toastState,
  } = props;

  if (!leagueId) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8 text-fg-1">
        <p className="mb-6 section-label">Manager: {username || "Sporty User"}</p>
        <div className="mb-6 card-surface p-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[3px] border border-white/8 text-fg-3">
            <ArrowLeftRight className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="font-sans text-base font-700 uppercase tracking-[1px] text-fg-1">
            Select a league to manage transfers
          </h2>
          <p className="mt-1 text-sm text-fg-3">
            Open transfers from one of your leagues. Your transfer history is
            still available below.
          </p>
          <Link
            href="/leagues"
            className="mt-5 inline-flex rounded-[3px] bg-accent px-6 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright"
          >
            My Leagues
          </Link>
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
    <section className="mx-auto max-w-7xl px-6 py-8 text-fg-1">
      <p className="mb-6 section-label">Manager: {username || "Sporty User"}</p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-[3fr_2fr_2fr] lg:gap-8">
        {/* Market: browse and add players */}
        <div className="space-y-4">
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
            isLoading={isLoading}
          />
          {transfersRemaining !== null ? (
            <div className="rounded-[3px] border border-accent/20 bg-accent/8 px-4 py-2.5 font-sans text-xs font-700 uppercase tracking-[1.5px] text-accent">
              {transfersRemaining} transfers remaining this session
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

          <div className="flex flex-col gap-3 card-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-fg-3">
              <span className="font-sans font-700 uppercase tracking-[1px] text-fg-1">
                Page {playersCurrentPage}
              </span>
              <span>/ {playersTotalPages}</span>
              <span className="hidden sm:inline">•</span>
              <span>{playersTotal} players</span>
              {isPlayersPageLoading ? (
                <span className="inline-flex items-center gap-1 rounded-[3px] bg-accent/10 px-2.5 py-1 text-xs text-accent">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePreviousPlayersPage}
                disabled={playersCurrentPage <= 1 || isPlayersPageLoading}
                className="inline-flex items-center gap-1 rounded-[3px] border border-white/8 bg-surface-3 px-3.5 py-1.5 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-2 transition-colors hover:text-fg-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                type="button"
                onClick={handleNextPlayersPage}
                disabled={
                  playersCurrentPage >= playersTotalPages || isPlayersPageLoading
                }
                className="inline-flex items-center gap-1 rounded-[3px] border border-white/8 bg-surface-3 px-3.5 py-1.5 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-2 transition-colors hover:text-fg-1 disabled:cursor-not-allowed disabled:opacity-50"
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
              <EmptyState
                icon={SearchX}
                title="No players found"
                description="Try adjusting your filters"
                actions={[
                  { label: "Clear Filters", onClick: clearAllFilters, variant: "secondary" },
                ]}
              />
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
                  photoUrl={player.photoUrl}
                  realTeam={player.realTeam}
                  realTeamLogoUrl={player.realTeamLogoUrl}
                  nationality={player.nationality}
                  flagUrl={player.flagUrl}
                  onAdd={handleAddPlayer}
                  animationDelay={index * 60}
                  disabled={!isTransfersOpen}
                />
              ))
            )}
          </div>
        </div>

        {/* Your roster: stage players out */}
        <div className="space-y-4">
          <SquadValidationChecklist
            title="Squad Rules"
            rules={positionValidation}
            clubWarnings={clubCounts}
          />
          <CurrentRoster
            players={visibleOwnedPlayers as OwnedPlayer[]}
            onDrop={handleStageOut}
            budget={budget}
            maxPlayers={league?.squad_size || 15}
            selectedOutId={selectedOutPlayer?.id}
            disabled={!isTransfersOpen}
          />
          {selectedOutPlayer && (
            <div className="flex items-center justify-between gap-3 rounded-[3px] border border-accent/25 bg-accent/8 px-4 py-3">
              <div className="min-w-0">
                <p className="section-label">Swapping Out</p>
                <p className="mt-0.5 truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
                  {selectedOutPlayer.name}
                </p>
              </div>
              <button
                type="button"
                onClick={cancelStagedSession}
                className="shrink-0 text-fg-3 transition-colors hover:text-fg-1"
                aria-label="Cancel swap"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Staged transfers: review and confirm */}
        <div className="space-y-4 md:col-span-2 lg:col-span-1">
          <div className="overflow-hidden rounded-[3px] border border-accent/20 bg-surface-1">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <p className="section-label">Staged Transfers</p>
              <span className="font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
                {stagedOutPlayers.length} out · {stagedInPlayers.length} in
              </span>
            </div>

            {stagedOutPlayers.length === 0 && stagedInPlayers.length === 0 ? (
              <p className="p-4 text-sm text-fg-3">
                Stage players out from your roster and in from the market to
                build a transfer, then confirm below.
              </p>
            ) : (
              <div className="space-y-4 p-4">
                <div>
                  <p className="mb-2 flex items-center gap-1 font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-danger">
                    <ArrowDown className="h-3 w-3" /> Out
                  </p>
                  <div className="space-y-1.5">
                    {stagedOutPlayers.length === 0 ? (
                      <p className="text-xs text-fg-3">—</p>
                    ) : (
                      stagedOutPlayers.map((player) => (
                        <PlayerListCard
                          key={player.id}
                          player={{
                            id: player.id,
                            name: player.name,
                            photoUrl: player.photoUrl,
                            position: player.position,
                            realTeam: player.realTeam,
                            realTeamLogoUrl: player.realTeamLogoUrl,
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-1 font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-success">
                    <ArrowUp className="h-3 w-3" /> In
                  </p>
                  <div className="space-y-1.5">
                    {stagedInPlayers.length === 0 ? (
                      <p className="text-xs text-fg-3">—</p>
                    ) : (
                      stagedInPlayers.map((player) => (
                        <PlayerListCard
                          key={player.id}
                          player={{
                            id: player.id,
                            name: player.name,
                            photoUrl: player.photoUrl,
                            position: player.position,
                            realTeam: player.realTeam,
                            realTeamLogoUrl: player.realTeamLogoUrl,
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

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
                  !isTransfersOpen ||
                  !isSquadValid
                }
                className="w-full rounded-[3px] bg-accent px-4 py-2.5 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmTransfersMutation.isPending
                  ? "Confirming…"
                  : "Confirm Staged Transfers"}
              </button>
              {unmetRule ? (
                <p className="mt-2 text-xs text-danger">{unmetRule}</p>
              ) : null}
              {isMultiSportLeague ? (
                <p className="mt-2 text-xs text-fg-3">
                  Multisport: you can stage players in directly when budget and
                  roster limits allow.
                </p>
              ) : null}
              {selectedOutPlayer ? (
                <button
                  type="button"
                  onClick={cancelStagedSession}
                  className="mt-2 w-full rounded-[3px] border border-white/8 bg-surface-3 px-4 py-2 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-2 transition-colors hover:text-fg-1"
                >
                  Cancel Staged Session
                </button>
              ) : null}
            </div>
          </div>
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

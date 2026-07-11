"use client";

import { EmptyState, ErrorState } from "@/components/ui";
import { LineupHeader } from "./components/LineupHeader";
import { LineupContainer } from "./components/LineupContainer";
import { LineupPitchView } from "./components/LineupPitchView";
import { LineupViewToggle } from "./components/LineupViewToggle";
import { InitialLineupBoard } from "./components/InitialLineupBoard";
import { LineupSkeleton } from "./components/LineupSkeleton";
import { LineupToolbar } from "./components/LineupToolbar";
import { SaveLineupButton } from "./components/SaveLineupButton";
import { GameweekContextBar } from "@/features/leagues/components/GameweekContextBar";
import { useLineupState, type HeaderSport } from "./hooks/useLineupState";

export function LeagueLineup() {
  const {
    leagueId,
    leagueLoading,
    leagueError,
    activeWindow,
    isWindowLoading,
    windowError,
    liveWindow,
    lineupLoading,
    lineupError,
    isEmpty,
    refetchLineup,
    updateLineup,
    isOptimizing,
    viewMode,
    setViewMode,
    editablePlayers,
    benchOrder,
    handleReorderBench,
    startersGroupedBySport,
    benchGroupedBySport,
    lineupSport,
    lineupRules,
    startersCount,
    benchCount,
    targetBenchCount,
    isInitialSetupMode,
    captain,
    viceCaptain,
    starterCountsBySport,
    selectionErrorMessage,
    canSave,
    isLineupOpen,
    isDirty,
    toggleStarter,
    swapStarter,
    setCaptain,
    setViceCaptain,
    handleSaveLineup,
    handleOptimizeLineup,
    selectedLeague,
  } = useLineupState();

  if (leagueLoading || lineupLoading || isWindowLoading || !selectedLeague) {
    return <LineupSkeleton />;
  }

  if (leagueError || lineupError || windowError) {
    const message =
      leagueError?.message || lineupError?.message || windowError?.message;

    return (
      <section className="space-y-6">
        <ErrorState message={message} onRetry={refetchLineup} />
      </section>
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        title="You don't have any players in this league yet"
        description="Join a league or make transfers to add players"
        actions={[
          {
            label: "Go to Transfers",
            href: `/leagues/${leagueId}/transfers`,
            variant: "primary",
          },
        ]}
      />
    );
  }

  return (
    <section className="space-y-6">
      <LineupHeader
        leagueName={selectedLeague.leagueName}
        teamName={selectedLeague.teamName}
        sport={selectedLeague.sport as HeaderSport}
        currentWeek={selectedLeague.currentWeek}
        totalWeeks={selectedLeague.totalWeeks}
        deadline={selectedLeague.deadline}
      />

      <GameweekContextBar
        leagueId={leagueId}
        editableWindow={activeWindow}
        activeWindow={liveWindow}
        deadlineField="lineup_deadline_at"
      />

      <LineupViewToggle value={viewMode} onChange={setViewMode} />

      <LineupToolbar
        isOptimizing={isOptimizing}
        onOptimize={handleOptimizeLineup}
        disabled={updateLineup.isPending}
        total={editablePlayers.length}
        startersCount={startersCount}
        requiredStarters={lineupRules.starters}
        benchCount={benchCount}
        targetBenchCount={targetBenchCount}
        captainName={captain?.name}
        viceCaptainName={viceCaptain?.name}
        isMultisport={lineupSport === "multisport"}
        footballCount={starterCountsBySport.football ?? 0}
        basketballCount={starterCountsBySport.basketball ?? 0}
        errorMessage={selectionErrorMessage}
      />

      {isInitialSetupMode ? (
        <InitialLineupBoard
          sportLabel={lineupRules.label}
          sportType={lineupSport}
          requiredStarters={lineupRules.starters}
          requiredBench={targetBenchCount}
          selectedStarterCount={startersCount}
        />
      ) : null}

      {viewMode === "list" ? (
        <LineupContainer
          startersGroupedBySport={startersGroupedBySport}
          benchGroupedBySport={benchGroupedBySport}
          onToggleStarter={toggleStarter}
          onSetCaptain={setCaptain}
          onSetViceCaptain={setViceCaptain}
          starterLimitReached={startersCount >= lineupRules.starters}
          disabled={updateLineup.isPending || !isLineupOpen}
        />
      ) : (
        <LineupPitchView
          allPlayers={editablePlayers}
          benchOrder={benchOrder}
          onReorderBench={handleReorderBench}
          onToggleStarter={toggleStarter}
          onSwapStarter={swapStarter}
          onSetCaptain={setCaptain}
          onSetViceCaptain={setViceCaptain}
          starterLimitReached={startersCount >= lineupRules.starters}
          disabled={updateLineup.isPending || !isLineupOpen}
        />
      )}

      <SaveLineupButton
        onSave={handleSaveLineup}
        isLoading={updateLineup.isPending || isOptimizing}
        isDirty={isDirty}
        disabled={!canSave || isOptimizing || !isLineupOpen}
      />
    </section>
  );
}

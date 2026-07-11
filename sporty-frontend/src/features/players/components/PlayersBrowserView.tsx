"use client";

import { useState } from "react";
import { Search, SearchX } from "lucide-react";

import { EmptyState, PageContainer, PageHeader, Select } from "@/components/ui";
import { Input } from "@/components/ui/Input";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";
import { useSports } from "@/hooks/leagues/useLeagues";
import { usePlayerFilters } from "@/hooks/players/usePlayerFilters";
import { usePlayers } from "@/hooks/players/usePlayers";
import { PlayerBrowserCard } from "@/features/players/components/PlayerBrowserCard";

const PAGE_SIZE = 24;

export function PlayersBrowserView() {
  const [page, setPage] = useState(1);
  const { data: sports } = useSports();
  const {
    searchQuery,
    setSearchQuery,
    selectedPosition,
    setSelectedPosition,
    selectedSport,
    setSelectedSport,
    filters,
  } = usePlayerFilters();

  const { data, isLoading, isFetching } = usePlayers({
    ...filters,
    page,
    page_size: PAGE_SIZE,
  });

  const players = data?.items ?? [];
  const hasNext = data?.has_next ?? false;

  const handleFilterChange = <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setPage(1);
      setter(value);
    };

  return (
    <PageContainer>
      <PageHeader
        title="Players"
        subtitle="Browse every player across your sports"
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3"
            aria-hidden
          />
          <Input
            value={searchQuery}
            onChange={(e) => handleFilterChange(setSearchQuery)(e.target.value)}
            placeholder="Search players…"
            className="pl-10"
            aria-label="Search players"
          />
        </div>

        <Select
          value={selectedSport}
          onChange={handleFilterChange(setSelectedSport)}
          aria-label="Filter by sport"
          options={[
            { value: "All", label: "All Sports" },
            ...(sports ?? []).map((sport) => ({
              value: sport.name,
              label: sport.display_name,
            })),
          ]}
        />

        <Select
          value={selectedPosition}
          onChange={handleFilterChange(setSelectedPosition)}
          aria-label="Filter by position"
          options={[
            { value: "All", label: "All Positions" },
            { value: "GK", label: "GK" },
            { value: "DEF", label: "DEF" },
            { value: "MID", label: "MID" },
            { value: "FWD", label: "FWD" },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <PlayerCardSkeleton key={i} />
          ))}
        </div>
      ) : players.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No results found"
          description="Try searching for something else"
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => (
              <PlayerBrowserCard key={player.id} player={player} />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isFetching}
              className="rounded-[3px] border border-white/12 px-4 py-2 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-1 transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-fg-3">Page {page}</span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext || isFetching}
              className="rounded-[3px] border border-white/12 px-4 py-2 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-1 transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </PageContainer>
  );
}

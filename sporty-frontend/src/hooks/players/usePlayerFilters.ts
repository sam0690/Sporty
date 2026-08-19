"use client";

import { useEffect, useMemo, useState } from "react";
import { ALL_CLUBS } from "@/lib/clubOptions";
import type { TPlayerFilter } from "@/types";

function parseCostInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function usePlayerFilters(initialSportName?: string) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [selectedPosition, setSelectedPosition] = useState("All");
  const [selectedSport, setSelectedSport] = useState(initialSportName ?? "All");
  const [selectedClub, setSelectedClub] = useState(ALL_CLUBS);
  const [minCostInput, setMinCostInput] = useState("");
  const [maxCostInput, setMaxCostInput] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedName(searchQuery.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchQuery]);

  // Follow initialSportName when it changes (adjust-state-during-render,
  // per https://react.dev/learn/you-might-not-need-an-effect).
  const [prevInitialSport, setPrevInitialSport] = useState(initialSportName);
  if (initialSportName !== prevInitialSport) {
    setPrevInitialSport(initialSportName);
    if (initialSportName) {
      setSelectedSport(initialSportName);
    }
  }

  const filters = useMemo<TPlayerFilter>(() => {
    return {
      name: debouncedName || undefined,
      position: selectedPosition === "All" ? undefined : selectedPosition,
      sport_name: selectedSport === "All" ? undefined : selectedSport,
      real_team: selectedClub === ALL_CLUBS ? undefined : selectedClub,
      minCost: parseCostInput(minCostInput),
      maxCost: parseCostInput(maxCostInput),
    };
  }, [
    debouncedName,
    selectedPosition,
    selectedSport,
    selectedClub,
    minCostInput,
    maxCostInput,
  ]);

  // A club only exists within one sport, so keeping it across a sport switch
  // guarantees an empty list. Reset here rather than at each of the three call
  // sites that own a sport control.
  const changeSport = (sport: string) => {
    setSelectedSport(sport);
    setSelectedClub(ALL_CLUBS);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedPosition("All");
    setSelectedSport(initialSportName ?? "All");
    setSelectedClub(ALL_CLUBS);
    setMinCostInput("");
    setMaxCostInput("");
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedPosition,
    setSelectedPosition,
    selectedSport,
    setSelectedSport: changeSport,
    selectedClub,
    setSelectedClub,
    minCostInput,
    setMinCostInput,
    maxCostInput,
    setMaxCostInput,
    filters,
    clearFilters,
  } as const;
}

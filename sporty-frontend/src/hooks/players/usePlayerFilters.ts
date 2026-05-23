"use client";

import { useEffect, useMemo, useState } from "react";
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

  useEffect(() => {
    if (initialSportName) {
      setSelectedSport(initialSportName);
    }
  }, [initialSportName]);

  const filters = useMemo<TPlayerFilter>(() => {
    return {
      name: debouncedName || undefined,
      position: selectedPosition === "All" ? undefined : selectedPosition,
      sport_name: selectedSport === "All" ? undefined : selectedSport,
      minCost: parseCostInput(minCostInput),
      maxCost: parseCostInput(maxCostInput),
    };
  }, [
    debouncedName,
    selectedPosition,
    selectedSport,
    minCostInput,
    maxCostInput,
  ]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedPosition("All");
    setSelectedSport(initialSportName ?? "All");
    setMinCostInput("");
    setMaxCostInput("");
  };

  return {
    searchQuery,
    setSearchQuery,
    selectedPosition,
    setSelectedPosition,
    selectedSport,
    setSelectedSport,
    minCostInput,
    setMinCostInput,
    maxCostInput,
    setMaxCostInput,
    filters,
    clearFilters,
  } as const;
}

"use client";

import { Search } from "lucide-react";

type SearchBarProps = {
  value: string;
  onSearch: (query: string) => void;
};

export function SearchBar({ value, onSearch }: SearchBarProps) {
  return (
    <div className="relative group">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fg-3" />

      <input
        type="search"
        value={value}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Search players..."
        className="w-full rounded-[3px] border border-white/12 bg-surface-1 py-3 pl-12 pr-5 text-fg-1 outline-none transition-colors placeholder:text-fg-3 focus:border-accent"
      />
    </div>
  );
}

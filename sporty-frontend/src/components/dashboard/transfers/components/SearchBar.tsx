"use client";

import { Search } from "lucide-react";

type SearchBarProps = {
  value: string;
  onSearch: (query: string) => void;
};

export function SearchBar({ value, onSearch }: SearchBarProps) {
  return (
    <div className="relative group">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

      <input
        type="search"
        value={value}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Search players..."
        className="w-full rounded-full border border-white/10 bg-surface/85 py-3 pl-12 pr-5 text-foreground outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
      />
    </div>
  );
}

"use client";

import { Search } from "lucide-react";

type SearchBarProps = {
  value: string;
  onSearch: (query: string) => void;
};

export function SearchBar({ value, onSearch }: SearchBarProps) {
  return (
    <div className="relative group">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#555560]" />

      <input
        type="search"
        value={value}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Search players..."
        className="w-full rounded-[3px] border border-[rgba(255,255,255,0.12)] bg-[#111117] py-3 pl-12 pr-5 text-[#f0f0f0] outline-none transition-colors placeholder:text-[#555560] focus:border-[#e8fb25]"
      />
    </div>
  );
}

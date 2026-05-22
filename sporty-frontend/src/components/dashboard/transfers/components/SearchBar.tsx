"use client";

import { useCallback, useEffect, useRef } from "react";
import { Search } from "lucide-react";

type SearchBarProps = {
  onSearch: (query: string) => void;
  resetToken?: number;
};

export function SearchBar({ onSearch, resetToken = 0 }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const scheduleSearch = useCallback(
    (value: string) => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        onSearch(value);
      }, 300);
    },
    [onSearch],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [onSearch]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    scheduleSearch("");
  }, [resetToken, scheduleSearch]);

  return (
    <div className="relative group">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

      <input
        ref={inputRef}
        type="search"
        defaultValue=""
        onChange={(event) => scheduleSearch(event.target.value)}
        placeholder="Search players..."
        className="w-full rounded-full border border-white/10 bg-surface/85 py-3 pl-12 pr-5 text-foreground outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
      />
    </div>
  );
}

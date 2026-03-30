"use client";

import { useEffect, useState } from "react";

type SearchBarProps = {
  onSearch: (query: string) => void;
};

export function SearchBar({ onSearch }: SearchBarProps) {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onSearch(inputValue);
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [inputValue, onSearch]);

  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </span>

      <input
        type="search"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        placeholder="Search players by name..."
        className="w-full rounded-lg border border-border px-4 py-2 pl-10 text-text-primary outline-none transition-shadow focus:ring-2 focus:ring-primary-500"
      />
    </div>
  );
}

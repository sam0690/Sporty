"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

type SearchBarProps = {
  onSearch: (query: string) => void;
  resetToken?: number;
};

export function SearchBar({ onSearch, resetToken = 0 }: SearchBarProps) {
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onSearch(inputValue);
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [inputValue, onSearch]);

  useEffect(() => {
    setInputValue("");
  }, [resetToken]);

  return (
    <div className="relative group">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary/60" />

      <input
        type="search"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        placeholder="Search players..."
        className="w-full rounded-full border border-border bg-white py-3 pl-12 pr-5 text-black outline-none transition-all duration-200 placeholder:text-secondary/60 focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

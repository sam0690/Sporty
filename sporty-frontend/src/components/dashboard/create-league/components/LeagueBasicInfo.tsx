"use client";

import { useMemo } from "react";

type LeagueBasicInfoProps = {
  leagueName: string;
  sport: string;
  leagueLogo: string;
  onLeagueNameChange: (value: string) => void;
  onSportChange: (value: string) => void;
  onLeagueLogoChange: (value: string) => void;
};

type SportOption = {
  value: string;
  label: string;
  icon: string;
};

const sportOptions: SportOption[] = [
  { value: "football", label: "Football", icon: "⚽" },
  { value: "basketball", label: "Basketball", icon: "🏀" },
  { value: "multisport", label: "Multi-Sport", icon: "⚽🏀" },
];

export function LeagueBasicInfo({
  leagueName,
  sport,
  leagueLogo,
  onLeagueNameChange,
  onSportChange,
  onLeagueLogoChange,
}: LeagueBasicInfoProps) {
  const helperText = useMemo(() => {
    if (!sport) return "Select the sport to unlock scoring settings.";
    const selected = sportOptions.find((option) => option.value === sport);
    return selected ? `Selected: ${selected.label}` : "";
  }, [sport]);

  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor="league-name"
          className="mb-1 block text-sm text-secondary"
        >
          League Name
        </label>
        <input
          id="league-name"
          value={leagueName}
          onChange={(event) => onLeagueNameChange(event.target.value)}
          maxLength={50}
          required
          placeholder="Champions League 2025"
          className="w-full rounded-md border border-border px-4 py-3 text-black outline-none transition focus:border-primary-400"
        />
        <p className="mt-2 text-right text-xs text-secondary/60">
          {leagueName.length}/50
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm text-secondary">Select Sport</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {sportOptions.map((option) => {
            const isSelected = option.value === sport;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSportChange(option.value)}
                className={`rounded-md border p-4 text-center transition-colors ${
                  isSelected
                    ? "border-primary-500 bg-primary/10"
                    : "border-border hover:border-border"
                }`}
              >
                <span className="mb-2 block text-3xl" aria-hidden="true">
                  {option.icon}
                </span>
                <span className="text-sm font-medium text-black">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-secondary/60">{helperText}</p>
      </div>

      <div>
        <p className="mb-2 text-sm text-secondary">League Logo</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="league-logo"
              className="mb-1 block text-xs uppercase tracking-widest text-secondary"
            >
              Emoji/Icon
            </label>
            <input
              id="league-logo"
              value={leagueLogo}
              onChange={(event) => onLeagueLogoChange(event.target.value)}
              placeholder="🏆"
              className="w-full rounded-md border border-border px-4 py-3 text-black outline-none transition focus:border-primary-400"
            />
          </div>
          <div>
            <label
              htmlFor="league-logo-upload"
              className="mb-1 block text-xs uppercase tracking-widest text-secondary"
            >
              Upload
            </label>
            <input
              id="league-logo-upload"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  onLeagueLogoChange(file.name);
                }
              }}
              className="w-full cursor-pointer rounded-md border border-border px-4 py-3 text-black file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-secondary/60">
          Optional: add an emoji or upload a badge.
        </p>
      </div>
    </div>
  );
}

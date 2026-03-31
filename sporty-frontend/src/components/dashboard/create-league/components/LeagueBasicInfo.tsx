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
  { value: "cricket", label: "Cricket", icon: "🏏" },
  { value: "multisport", label: "Multi-Sport", icon: "⚽🏀🏏" },
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
        <label htmlFor="league-name" className="mb-2 block text-sm font-medium text-text-primary">
          League Name
        </label>
        <input
          id="league-name"
          value={leagueName}
          onChange={(event) => onLeagueNameChange(event.target.value)}
          maxLength={50}
          required
          placeholder="Champions League 2025"
          className="w-full rounded-lg border border-border px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-primary-500"
        />
        <p className="mt-2 text-xs text-text-secondary">Max 50 characters.</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-text-primary">Select Sport</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sportOptions.map((option) => {
            const isSelected = option.value === sport;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSportChange(option.value)}
                className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                  isSelected ? "border-primary-500 bg-primary-50" : "border-border hover:border-primary-500"
                }`}
              >
                <span className="text-2xl" aria-hidden="true">
                  {option.icon}
                </span>
                <span className="font-medium text-text-primary">{option.label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-text-secondary">{helperText}</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-text-primary">League Logo</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="league-logo" className="mb-1 block text-xs uppercase tracking-widest text-text-secondary">
              Emoji/Icon
            </label>
            <input
              id="league-logo"
              value={leagueLogo}
              onChange={(event) => onLeagueLogoChange(event.target.value)}
              placeholder="🏆"
              className="w-full rounded-lg border border-border px-4 py-3 text-text-primary outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="league-logo-upload" className="mb-1 block text-xs uppercase tracking-widest text-text-secondary">
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
              className="w-full cursor-pointer rounded-lg border border-border px-4 py-3 text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-primary-600"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-text-secondary">Optional: add an emoji or upload a badge.</p>
      </div>
    </div>
  );
}

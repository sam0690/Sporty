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
          className="mb-1 block text-sm text-slate-400"
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
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-foreground outline-none transition-all focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
        />
        <p className="mt-2 text-right text-xs text-slate-500">
          {leagueName.length}/50
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm text-slate-400">Select Sport</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {sportOptions.map((option) => {
            const isSelected = option.value === sport;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSportChange(option.value)}
                className={`rounded-2xl border p-4 text-center transition-all ${
                  isSelected
                    ? "border-accent-primary/30 bg-white/10 shadow-[0_0_0_1px_rgba(0,229,255,0.15)]"
                    : "border-white/10 bg-white/5 hover:border-accent-primary/20 hover:bg-white/8"
                }`}
              >
                <span className="mb-2 block text-3xl" aria-hidden="true">
                  {option.icon}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">{helperText}</p>
      </div>

      {/* <div>
        <p className="mb-2 text-sm text-slate-400">League Logo</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="league-logo"
              className="mb-1 block text-xs uppercase tracking-widest text-slate-500"
            >
              Emoji/Icon
            </label>
            <input
              id="league-logo"
              value={leagueLogo}
              onChange={(event) => onLeagueLogoChange(event.target.value)}
              placeholder="🏆"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-foreground outline-none transition-all focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
            />
          </div>
          <div>
            <label
              htmlFor="league-logo-upload"
              className="mb-1 block text-xs uppercase tracking-widest text-slate-500"
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
              className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-accent-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-accent-primary"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Optional: add an emoji or upload a badge.
        </p>
      </div> */}
    </div>
  );
}

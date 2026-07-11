"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

type LeagueBasicInfoProps = {
  leagueName: string;
  sport: string;
  onLeagueNameChange: (value: string) => void;
  onSportChange: (value: string) => void;
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
  onLeagueNameChange,
  onSportChange,
}: LeagueBasicInfoProps) {
  const prefersReducedMotion = useReducedMotion();
  const helperText = useMemo(() => {
    if (!sport) return "Select a sport to get started.";
    const selected = sportOptions.find((option) => option.value === sport);
    return selected ? `Selected: ${selected.label}` : "";
  }, [sport]);

  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor="league-name"
          className="mb-2 block font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5]"
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
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-2.5 text-sm text-[#f0f0f0] outline-none transition-colors focus:border-[#e8fb25]"
        />
        <p className="mt-2 text-right text-xs text-[#555560]">
          {leagueName.length}/50
        </p>
      </div>

      <div>
        <p className="mb-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5]">
          Select Sport
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sportOptions.map((option) => {
            const isSelected = option.value === sport;
            return (
              <motion.button
                key={option.value}
                type="button"
                onClick={() => onSportChange(option.value)}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                animate={{ scale: isSelected ? 1.03 : 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
                className={`rounded-[3px] border p-4 text-center transition-colors ${
                  isSelected
                    ? "border-[rgba(232,251,37,0.4)] bg-[rgba(232,251,37,0.08)]"
                    : "border-[rgba(255,255,255,0.08)] bg-[#0d0d12] hover:border-[rgba(255,255,255,0.18)]"
                }`}
              >
                <span className="mb-2 block text-3xl" aria-hidden="true">
                  {option.icon}
                </span>
                <span
                  className={`font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] ${
                    isSelected ? "text-[#e8fb25]" : "text-[#f0f0f0]"
                  }`}
                >
                  {option.label}
                </span>
              </motion.button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[#555560]">{helperText}</p>
      </div>

      {/* <div>
        <p className="mb-2 text-sm text-[#555560]">League Logo</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="league-logo"
              className="mb-1 block text-xs uppercase tracking-widest text-[#555560]"
            >
              Emoji/Icon
            </label>
            <input
              id="league-logo"
              value={leagueLogo}
              onChange={(event) => onLeagueLogoChange(event.target.value)}
              placeholder="🏆"
              className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3 text-[#f0f0f0] outline-none transition-all focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
            />
          </div>
          <div>
            <label
              htmlFor="league-logo-upload"
              className="mb-1 block text-xs uppercase tracking-widest text-[#555560]"
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
              className="w-full cursor-pointer rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3 text-[#f0f0f0] file:mr-3 file:rounded-full file:border-0 file:bg-[rgba(232,251,37,0.1)] file:px-3 file:py-1 file:text-sm file:font-medium file:text-[#e8fb25]"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-[#555560]">
          Optional: add an emoji or upload a badge.
        </p>
      </div> */}
    </div>
  );
}

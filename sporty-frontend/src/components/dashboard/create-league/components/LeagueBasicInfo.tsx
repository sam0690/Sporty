"use client";

import { useMemo } from "react";
import { SportIcon } from "@/components/landing/sport-icons";

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
};

const sportOptions: SportOption[] = [
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball" },
  { value: "multisport", label: "Multi-Sport" },
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
          className="mb-2 block font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#6B7280]"
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
          className="w-full rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-2.5 text-sm text-[#0B1220] outline-none transition-colors focus:border-[#DC2626]"
        />
        <p className="mt-2 text-right text-xs text-[#6B7280]">
          {leagueName.length}/50
        </p>
      </div>

      <div>
        <p className="mb-2 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#6B7280]">
          Select Sport
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sportOptions.map((option) => {
            const isSelected = option.value === sport;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onSportChange(option.value)}
                className={`rounded-[3px] border p-4 text-center transition-colors ${
                  isSelected
                    ? "border-[rgba(220,38,38,0.4)] bg-[rgba(220,38,38,0.08)]"
                    : "border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] hover:border-[rgba(11,18,32,0.18)]"
                }`}
              >
                <span className="mb-2 flex justify-center" aria-hidden="true">
                  <SportIcon
                    sport={option.value}
                    className="h-7 w-7"
                    tint
                  />
                </span>
                <span
                  className={`font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] ${
                    isSelected ? "text-[#DC2626]" : "text-[#0B1220]"
                  }`}
                >
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[#6B7280]">{helperText}</p>
      </div>

      {/* <div>
        <p className="mb-2 text-sm text-[#6B7280]">League Logo</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="league-logo"
              className="mb-1 block text-xs uppercase tracking-widest text-[#6B7280]"
            >
              Emoji/Icon
            </label>
            <input
              id="league-logo"
              value={leagueLogo}
              onChange={(event) => onLeagueLogoChange(event.target.value)}
              placeholder="Badge"
              className="w-full rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-4 py-3 text-[#0B1220] outline-none transition-all focus:border-[rgba(220,38,38,0.3)] focus:border-[#DC2626]"
            />
          </div>
          <div>
            <label
              htmlFor="league-logo-upload"
              className="mb-1 block text-xs uppercase tracking-widest text-[#6B7280]"
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
              className="w-full cursor-pointer rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-4 py-3 text-[#0B1220] file:mr-3 file:rounded-full file:border-0 file:bg-[rgba(220,38,38,0.1)] file:px-3 file:py-1 file:text-sm file:font-medium file:text-[#DC2626]"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-[#6B7280]">
          Optional: add an emoji or upload a badge.
        </p>
      </div> */}
    </div>
  );
}

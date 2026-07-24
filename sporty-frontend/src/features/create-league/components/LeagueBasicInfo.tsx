"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  FOOTBALL_COMPETITIONS,
  type CompetitionChoice,
} from "@/lib/footballCompetitions";

type LeagueBasicInfoProps = {
  leagueName: string;
  sport: string;
  competition: CompetitionChoice;
  onLeagueNameChange: (value: string) => void;
  onSportChange: (value: string) => void;
  onCompetitionChange: (value: CompetitionChoice) => void;
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
  competition,
  onLeagueNameChange,
  onSportChange,
  onCompetitionChange,
}: LeagueBasicInfoProps) {
  const prefersReducedMotion = useReducedMotion();
  const helperText = useMemo(() => {
    if (!sport) return "Select a sport to get started.";
    const selected = sportOptions.find((option) => option.value === sport);
    return selected ? `Selected: ${selected.label}` : "";
  }, [sport]);

  // The competition scope is a refinement of the football choice, so it only
  // applies when football is the sole sport (multisport draws its football
  // pool from every league). Shown as a compact secondary row under the sport
  // grid, not a peer of it.
  const showCompetitionPicker = sport === "football";

  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor="league-name"
          className="mb-2 block font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-2"
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
          className="w-full rounded-[3px] border border-white/8 bg-surface-2 px-4 py-2.5 text-sm text-fg-1 outline-none transition-colors focus:border-accent"
        />
        <p className="mt-2 text-right text-xs text-fg-3">
          {leagueName.length}/50
        </p>
      </div>

      <div>
        <p className="mb-2 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-2">
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
                    ? "border-accent/40 bg-accent/8"
                    : "border-white/8 bg-surface-2 hover:border-white/18"
                }`}
              >
                <span className="mb-2 block text-3xl" aria-hidden="true">
                  {option.icon}
                </span>
                <span
                  className={`font-sans text-sm font-700 uppercase tracking-[0.5px] ${
                    isSelected ? "text-accent" : "text-fg-1"
                  }`}
                >
                  {option.label}
                </span>
              </motion.button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-fg-3">{helperText}</p>
      </div>

      <AnimatePresence initial={false}>
        {showCompetitionPicker && (
          <motion.div
            key="competition-picker"
            initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-1">
              <p className="mb-2 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-2">
                Player Pool
              </p>
              <div
                role="radiogroup"
                aria-label="Football competition"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {FOOTBALL_COMPETITIONS.map((option) => {
                  const isSelected = option.value === competition;
                  return (
                    <motion.button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => onCompetitionChange(option.value)}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                      className={`flex items-center gap-2 rounded-[3px] border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "border-accent/40 bg-accent/8"
                          : "border-white/8 bg-surface-2 hover:border-white/18"
                      }`}
                    >
                      <span className="text-base leading-none" aria-hidden="true">
                        {option.flag}
                      </span>
                      <span
                        className={`font-sans text-xs font-700 uppercase tracking-[0.5px] ${
                          isSelected ? "text-accent" : "text-fg-2"
                        }`}
                      >
                        {option.short}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-fg-3">
                {competition === "ALL"
                  ? "Squads can draft from all three leagues."
                  : `Squads are limited to ${
                      FOOTBALL_COMPETITIONS.find((c) => c.value === competition)
                        ?.label ?? "this league"
                    } players.`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* <div>
        <p className="mb-2 text-sm text-fg-3">League Logo</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="league-logo"
              className="mb-1 block text-xs uppercase tracking-widest text-fg-3"
            >
              Emoji/Icon
            </label>
            <input
              id="league-logo"
              value={leagueLogo}
              onChange={(event) => onLeagueLogoChange(event.target.value)}
              placeholder="🏆"
              className="w-full rounded-[3px] border border-white/8 bg-surface-3 px-4 py-3 text-fg-1 outline-none transition-all focus:border-accent/30 focus:border-accent"
            />
          </div>
          <div>
            <label
              htmlFor="league-logo-upload"
              className="mb-1 block text-xs uppercase tracking-widest text-fg-3"
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
              className="w-full cursor-pointer rounded-[3px] border border-white/8 bg-surface-3 px-4 py-3 text-fg-1 file:mr-3 file:rounded-full file:border-0 file:bg-accent/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-accent"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-fg-3">
          Optional: add an emoji or upload a badge.
        </p>
      </div> */}
    </div>
  );
}

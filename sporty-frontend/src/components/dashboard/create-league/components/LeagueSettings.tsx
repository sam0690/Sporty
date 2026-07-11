"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type LeagueSettingsProps = {
  isPrivate: boolean;
  teamSize: number;
  competitionType: "draft" | "budget";
  draftDate: string;
  onSettingsChange: (next: {
    isPrivate?: boolean;
    teamSize?: number;
    competitionType?: "draft" | "budget";
    draftDate?: string;
  }) => void;
};

const teamSizes = [4, 6, 8, 10, 12, 14, 16];

const fieldLabel =
  "mb-2 block font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-2";

function RadioCard({
  selected,
  onSelect,
  title,
  desc,
  icon,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  desc: string;
  icon?: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
      className={`flex items-start gap-3 rounded-[3px] border p-4 text-left transition-colors ${
        selected
          ? "border-accent/40 bg-accent/8"
          : "border-white/8 bg-surface-2 hover:border-white/18"
      }`}
    >
      {icon ? (
        <span className="mt-0.5 shrink-0 text-2xl" aria-hidden="true">
          {icon}
        </span>
      ) : (
        <span
          className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${
            selected ? "border-accent" : "border-white/25"
          }`}
        >
          {selected && <span className="size-2 rounded-full bg-accent" />}
        </span>
      )}
      <span>
        <p
          className={`font-sans text-sm font-700 uppercase tracking-[0.5px] ${
            selected ? "text-accent" : "text-fg-1"
          }`}
        >
          {title}
        </p>
        <p className="mt-1 text-xs text-fg-3">{desc}</p>
      </span>
    </motion.button>
  );
}

function TeamSizeChip({
  size,
  selected,
  onSelect,
}: {
  size: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
      animate={{ scale: selected ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className={`rounded-full border px-4 py-2 font-sans text-sm font-700 uppercase tracking-[0.5px] transition-colors ${
        selected
          ? "border-accent bg-accent text-surface-0"
          : "border-white/12 bg-surface-2 text-fg-2 hover:border-white/25 hover:text-fg-1"
      }`}
      aria-pressed={selected}
    >
      {size}
    </motion.button>
  );
}

export function LeagueSettings({
  isPrivate,
  teamSize,
  competitionType,
  onSettingsChange,
}: LeagueSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className={fieldLabel}>League Type</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <RadioCard
            selected={!isPrivate}
            onSelect={() => onSettingsChange({ isPrivate: false })}
            title="Public"
            desc="Anyone can discover and join."
          />
          <RadioCard
            selected={isPrivate}
            onSelect={() => onSettingsChange({ isPrivate: true })}
            title="Private"
            desc="Join with an invite code only."
          />
        </div>
      </div>

      <div>
        <p className={fieldLabel}>Team Size</p>
        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Team size">
          {teamSizes.map((size) => (
            <TeamSizeChip
              key={size}
              size={size}
              selected={size === teamSize}
              onSelect={() => onSettingsChange({ teamSize: size })}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-fg-3">{teamSize} teams in this league.</p>
      </div>

      <div>
        <p className={fieldLabel}>Competition Type</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <RadioCard
            selected={competitionType === "budget"}
            onSelect={() => onSettingsChange({ competitionType: "budget" })}
            title="Budget Mode"
            desc="Auto-assign squads under a budget cap."
            icon="💰"
          />
          <RadioCard
            selected={competitionType === "draft"}
            onSelect={() => onSettingsChange({ competitionType: "draft" })}
            title="Draft Mode"
            desc="Take turns drafting players live."
            icon="🎯"
          />
        </div>
      </div>

      {/* Draft Date field hidden for now — re-enable once draft scheduling is supported.
      <div>
        <label htmlFor="draft-date" className={fieldLabel}>
          Draft Date (optional)
        </label>
        <input
          id="draft-date"
          type="date"
          value={draftDate}
          onChange={(event) =>
            onSettingsChange({ draftDate: event.target.value })
          }
          className={fieldControl}
          style={{ colorScheme: "dark" }}
        />
      </div>
      */}
    </div>
  );
}

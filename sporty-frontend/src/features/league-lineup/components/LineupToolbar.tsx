"use client";

import { MULTISPORT_STARTER_REQUIREMENTS } from "../hooks/useLineupState";

type ChipTone = "neutral" | "volt" | "gold" | "football" | "basketball";

const CHIP_TONES: Record<ChipTone, { border: string; value: string }> = {
  neutral: { border: "rgba(255,255,255,0.08)", value: "#f2f2f0" },
  volt: { border: "rgba(226,195,104,0.25)", value: "#e2c368" },
  gold: { border: "rgba(255,216,107,0.25)", value: "#ffd86b" },
  football: { border: "rgba(76,175,80,0.3)", value: "#00e07f" },
  basketball: { border: "rgba(255,107,0,0.3)", value: "#ff6b35" },
};

function StatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: ChipTone;
}) {
  const colors = CHIP_TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[3px] border bg-surface-2 px-3 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px]"
      style={{ borderColor: colors.border }}
    >
      <span className="text-fg-3">{label}</span>
      <span style={{ color: colors.value }}>{value}</span>
    </span>
  );
}

type LineupToolbarProps = {
  isOptimizing: boolean;
  onOptimize: () => void;
  disabled: boolean;
  total: number;
  startersCount: number;
  requiredStarters: number;
  benchCount: number;
  targetBenchCount: number;
  captainName: string | undefined;
  viceCaptainName: string | undefined;
  isMultisport: boolean;
  footballCount: number;
  basketballCount: number;
  errorMessage: string | null;
};

export function LineupToolbar({
  isOptimizing,
  onOptimize,
  disabled,
  total,
  startersCount,
  requiredStarters,
  benchCount,
  targetBenchCount,
  captainName,
  viceCaptainName,
  isMultisport,
  footballCount,
  basketballCount,
  errorMessage,
}: LineupToolbarProps) {
  return (
    <div className="card-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onOptimize}
          disabled={isOptimizing || disabled}
          className="rounded-[3px] border border-accent/35 bg-accent/10 px-4 py-1.5 font-sans text-xs font-700 uppercase tracking-[1.5px] text-accent transition-colors hover:bg-accent/18 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isOptimizing ? "Optimizing…" : "Auto-Optimize Lineup"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatChip label="Total" value={total} />
        <StatChip
          label="Starters"
          value={`${startersCount} / ${requiredStarters}`}
          tone="volt"
        />
        <StatChip label="Bench" value={`${benchCount} / ${targetBenchCount}`} />
        <StatChip label="Captain" value={captainName || "N/A"} tone="gold" />
        <StatChip label="Vice" value={viceCaptainName || "N/A"} tone="neutral" />
        {isMultisport ? (
          <>
            <StatChip
              label="Football"
              value={`${footballCount} / ${MULTISPORT_STARTER_REQUIREMENTS.football}`}
              tone="football"
            />
            <StatChip
              label="Basketball"
              value={`${basketballCount} / ${MULTISPORT_STARTER_REQUIREMENTS.basketball}`}
              tone="basketball"
            />
          </>
        ) : null}
      </div>
      {errorMessage ? (
        <p className="mt-3 rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[rgba(255,59,48,0.08)] px-3 py-2 text-sm text-danger-soft">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

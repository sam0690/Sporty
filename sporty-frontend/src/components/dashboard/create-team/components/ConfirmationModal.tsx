"use client";

import { ArrowLeft, Check } from "lucide-react";

type TeamData = {
  teamName: string;
  leagueName: string;
  selectedCount: number;
  requiredPlayers: number;
  totalCost: number;
  remainingBudget: number;
};

type ConfirmationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  teamData: TeamData;
  isLoading?: boolean;
};

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  teamData,
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  const overBudget = teamData.remainingBudget < 0;

  const rows: { label: string; value: string; emphasis?: boolean; danger?: boolean }[] = [
    { label: "Team Name", value: teamData.teamName },
    { label: "League", value: teamData.leagueName },
    {
      label: "Players",
      value: `${teamData.selectedCount}/${teamData.requiredPlayers}`,
    },
    { label: "Total Cost", value: `$${teamData.totalCost}`, emphasis: true },
    {
      label: "Remaining",
      value: `$${teamData.remainingBudget}`,
      emphasis: true,
      danger: overBudget,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-fade-in-scale w-full max-w-md overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]">
        {/* volt accent strip */}
        <div className="h-1 bg-[#DC2626]" />

        <div className="p-6">
          <p className="section-label">Final Step</p>
          <h2 className="mt-1 font-bebas text-3xl leading-none tracking-[2px] text-[#0B1220]">
            Confirm Team Creation
          </h2>

          <div className="mt-5 space-y-2.5 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-4">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="section-label">{row.label}</span>
                <span
                  className={
                    row.emphasis
                      ? `font-bebas text-lg leading-none tracking-[1px] tabular-nums ${
                          row.danger ? "text-[#DC2626]" : "text-[#DC2626]"
                        }`
                      : "truncate text-right font-barlow-condensed text-sm font-bold uppercase tracking-[0.5px] text-[#0B1220]"
                  }
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-5 py-2.5 font-barlow-condensed text-sm font-bold uppercase tracking-[1.5px] text-[#6B7280] transition-colors hover:text-[#0B1220]"
            >
              <ArrowLeft size={15} />
              Back
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#DC2626] px-6 py-2.5 font-barlow-condensed text-sm font-bold uppercase tracking-[1.5px] text-black transition-colors hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check size={15} />
              {isLoading ? "Creating…" : "Create Team"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

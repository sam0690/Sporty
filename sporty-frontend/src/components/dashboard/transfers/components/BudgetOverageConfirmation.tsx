"use client";

import type { TBudgetOverageDetail } from "@/types";

type BudgetOverageConfirmationProps = {
  detail: TBudgetOverageDetail | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
};

export function BudgetOverageConfirmation({
  detail,
  onConfirm,
  onCancel,
  isLoading,
}: BudgetOverageConfirmationProps) {
  if (!detail) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md overflow-hidden rounded-[3px] border border-[rgba(255,216,107,0.25)] bg-[#111117] animate-in zoom-in-95 duration-200">
        <div className="border-b border-[rgba(255,255,255,0.08)] px-6 py-4">
          <h3 className="font-barlow-condensed text-xl font-700 uppercase tracking-[2px] text-[#f0f0f0]">
            Over Budget
          </h3>
        </div>

        <div className="p-6">
          <p className="text-sm text-[#9a9aa5]">
            This transfer goes{" "}
            <span className="font-bebas tracking-[1px] text-[#ff3b30]">
              {detail.shortfall}
            </span>{" "}
            over budget. You can cover it with league points instead of
            cancelling.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[3px] border border-[rgba(255,216,107,0.2)] bg-[rgba(255,216,107,0.08)] p-3">
              <p className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#ffd86b]">
                Points Cost
              </p>
              <p className="mt-1 font-bebas text-xl tracking-[1px] text-[#f0f0f0]">
                {detail.points_cost}
              </p>
            </div>
            <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-3">
              <p className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#555560]">
                Available
              </p>
              <p className="mt-1 font-bebas text-xl tracking-[1px] text-[#f0f0f0]">
                {detail.available_points}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="w-full rounded-[3px] bg-[#ffd86b] py-3 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#0a0a0f] transition-colors hover:bg-[#ffe28a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading
                ? "Processing…"
                : `Cover with ${detail.points_cost} points`}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#9a9aa5] transition-colors hover:text-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

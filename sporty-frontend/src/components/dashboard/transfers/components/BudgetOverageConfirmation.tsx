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
      <div className="w-full max-w-md overflow-hidden rounded-[3px] border border-warning/25 bg-surface-1 animate-in zoom-in-95 duration-200">
        <div className="border-b border-white/8 px-6 py-4">
          <h3 className="font-barlow-condensed text-xl font-700 uppercase tracking-[2px] text-fg-1">
            Over Budget
          </h3>
        </div>

        <div className="p-6">
          <p className="text-sm text-fg-2">
            This transfer goes{" "}
            <span className="font-bebas tracking-[1px] text-danger">
              {detail.shortfall}
            </span>{" "}
            over budget. You can cover it with league points instead of
            cancelling.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[3px] border border-warning/20 bg-warning/8 p-3">
              <p className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-warning">
                Points Cost
              </p>
              <p className="mt-1 font-bebas text-xl tracking-[1px] text-fg-1">
                {detail.points_cost}
              </p>
            </div>
            <div className="rounded-[3px] border border-white/8 bg-surface-3 p-3">
              <p className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-fg-3">
                Available
              </p>
              <p className="mt-1 font-bebas text-xl tracking-[1px] text-fg-1">
                {detail.available_points}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="w-full rounded-[3px] bg-warning py-3 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-[#ffe28a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading
                ? "Processing…"
                : `Cover with ${detail.points_cost} points`}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="w-full rounded-[3px] border border-white/8 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-fg-2 transition-colors hover:text-fg-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

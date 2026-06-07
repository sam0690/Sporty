"use client";

type SaveLineupButtonProps = {
  onSave: () => void;
  isLoading: boolean;
  isDirty: boolean;
  disabled?: boolean;
};

export function SaveLineupButton({
  onSave,
  isLoading,
  isDirty,
  disabled = false,
}: SaveLineupButtonProps) {
  const isDisabled = !isDirty || disabled || isLoading;

  return (
    <div className="sticky bottom-0 border-t border-[rgba(255,255,255,0.08)] bg-[#0a0a0f] py-4">
      <div className="flex items-center justify-end gap-3">
        {isDirty && !isDisabled ? (
          <span className="animate-live-pulse h-2 w-2 rounded-[3px] bg-[#e8fb25]" aria-hidden="true" />
        ) : null}
        <button
          type="button"
          onClick={onSave}
          disabled={isDisabled}
          className={`rounded-[3px] px-8 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] transition-colors ${
            isDisabled
              ? "cursor-not-allowed bg-[#1d1d26] text-[#555560]"
              : "bg-[#e8fb25] text-[#0a0a0f] hover:bg-[#f0ff45]"
          }`}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-[3px] border-2 border-[#0a0a0f]/30 border-t-[#0a0a0f]" />
              Saving...
            </span>
          ) : (
            "Save Lineup"
          )}
        </button>
      </div>
    </div>
  );
}

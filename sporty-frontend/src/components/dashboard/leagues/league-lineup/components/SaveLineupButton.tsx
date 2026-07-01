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
    <div className="sticky bottom-0 border-t border-[rgba(11,18,32,0.08)] bg-[#F6F7F9] py-4">
      <div className="flex items-center justify-end gap-3">
        {isDirty && !isDisabled ? (
          <span className="animate-live-pulse h-2 w-2 rounded-[3px] bg-[#DC2626]" aria-hidden="true" />
        ) : null}
        <button
          type="button"
          onClick={onSave}
          disabled={isDisabled}
          className={`rounded-[3px] px-8 py-2.5 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] transition-colors ${
            isDisabled
              ? "cursor-not-allowed bg-[#F3F4F7] text-[#6B7280]"
              : "bg-[#DC2626] text-[#F6F7F9] hover:bg-[#B91C1C]"
          }`}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-[3px] border-2 border-[#F6F7F9]/30 border-t-[#F6F7F9]" />
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

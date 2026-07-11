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
    <div className="sticky bottom-0 border-t border-white/8 bg-surface-0 py-4">
      <div className="flex items-center justify-end gap-3">
        {isDirty && !isDisabled ? (
          <span className="animate-live-pulse h-2 w-2 rounded-[3px] bg-accent" aria-hidden="true" />
        ) : null}
        <button
          type="button"
          onClick={onSave}
          disabled={isDisabled}
          className={`rounded-[3px] px-8 py-2.5 font-sans text-xs font-700 uppercase tracking-[2px] transition-colors ${
            isDisabled
              ? "cursor-not-allowed bg-surface-3 text-fg-3"
              : "bg-accent text-surface-0 hover:bg-accent-bright"
          }`}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-[3px] border-2 border-surface-0/30 border-t-surface-0" />
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

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
    <div className="sticky bottom-0 border-t border-accent/20 bg-white/90 py-4 backdrop-blur-sm">
      <div className="flex items-center justify-end gap-2">
        {isDirty && !isDisabled ? (
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
        ) : null}

        <button
          type="button"
          onClick={onSave}
          disabled={isDisabled}
          className={`rounded-full px-8 py-2.5 font-medium text-white transition-colors ${
            isDisabled
              ? "cursor-not-allowed bg-accent/40"
              : `bg-primary hover:bg-primary-700 ${isDirty ? "animate-pulse" : ""}`
          }`}
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
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

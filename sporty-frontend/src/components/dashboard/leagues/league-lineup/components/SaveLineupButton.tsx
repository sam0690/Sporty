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
    <div className="sticky bottom-0 border-t border-border bg-white/80 p-4 backdrop-blur">
      <button
        type="button"
        onClick={onSave}
        disabled={isDisabled}
        className="rounded-lg bg-primary-500 px-6 py-2 text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
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
  );
}

"use client";

type ErrorAlertProps = {
  message: string;
  onDismiss: () => void;
};

export function ErrorAlert({ message, onDismiss }: ErrorAlertProps) {
  return (
    <section className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
      <div className="flex gap-2">
        <span aria-hidden="true">⚠️</span>
        <p className="text-sm">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-100"
        aria-label="Dismiss error"
      >
        X
      </button>
    </section>
  );
}

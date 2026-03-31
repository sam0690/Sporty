"use client";

type ErrorAlertProps = {
  message: string;
  onDismiss: () => void;
};

export function ErrorAlert({ message, onDismiss }: ErrorAlertProps) {
  return (
    <section className="mx-auto mb-6 flex max-w-md items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
      <div className="flex gap-2">
        <span aria-hidden="true" className="text-red-500">⚠️</span>
        <p className="text-sm">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md px-1.5 py-0.5 text-xs text-red-500 transition-colors hover:bg-red-100"
        aria-label="Dismiss error"
      >
        ×
      </button>
    </section>
  );
}

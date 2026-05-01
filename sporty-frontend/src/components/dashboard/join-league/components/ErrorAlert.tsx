"use client";

type ErrorAlertProps = {
  message: string;
  onDismiss: () => void;
};

export function ErrorAlert({ message, onDismiss }: ErrorAlertProps) {
  return (
    <section className="mx-auto mb-6 flex max-w-md items-start justify-between gap-3 rounded-md border border-danger/20 bg-danger/5 p-4 text-danger">
      <div className="flex gap-2">
        <span aria-hidden="true" className="text-danger">⚠️</span>
        <p className="text-sm">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md px-1.5 py-0.5 text-xs text-danger transition-colors hover:bg-danger/10"
        aria-label="Dismiss error"
      >
        ×
      </button>
    </section>
  );
}

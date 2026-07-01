"use client";

type ErrorAlertProps = {
  message: string;
  onDismiss: () => void;
};

export function ErrorAlert({ message, onDismiss }: ErrorAlertProps) {
  return (
    <section className="animate-fade-soft mx-auto flex max-w-md items-start justify-between gap-3 rounded-[10px] border border-[rgba(255,59,92,0.25)] bg-[rgba(255,59,92,0.07)] p-4 text-[#ff8a8a]">
      <div className="flex items-start gap-2.5">
        <svg
          viewBox="0 0 24 24"
          className="mt-0.5 size-4 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3l9 16H3z" />
          <path d="M12 10v4M12 17.5v.5" />
        </svg>
        <p className="text-sm">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="grid size-6 shrink-0 place-items-center rounded-[6px] text-[#ff8a8a] transition-colors hover:bg-[rgba(255,59,92,0.12)]"
        aria-label="Dismiss error"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </section>
  );
}

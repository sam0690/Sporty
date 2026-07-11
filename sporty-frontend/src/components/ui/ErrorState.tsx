"use client";

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <section
      className={`rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-surface-1 p-5 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-sans text-sm font-700 uppercase tracking-[1px] text-danger">
            {title}
          </h2>
          {message && <p className="mt-1 text-sm text-fg-3">{message}</p>}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-[3px] border border-[rgba(255,59,48,0.3)] bg-transparent px-4 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-danger transition-colors hover:bg-[rgba(255,59,48,0.1)]"
          >
            Retry
          </button>
        )}
      </div>
    </section>
  );
}

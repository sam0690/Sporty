"use client";

import { useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";

type CardErrorStateProps = {
  title?: string;
  description?: string;
  /** Return the refetch promise so the button can show a retrying state. */
  onRetry?: () => void | Promise<unknown>;
  className?: string;
};

/**
 * Graceful, reassuring error state for a dashboard card's content area.
 * Sibling to EmptyState — same inset language (transparent, centred, icon +
 * title + copy + one action) — but with a calm danger accent and a working
 * "Try again" that spins while the refetch is in flight. Use inside a card that
 * already provides the surface/border, not as a standalone panel.
 */
export function CardErrorState({
  title = "Couldn't load your team",
  description = "The connection dropped for a moment. Nothing's lost — give it another go.",
  onRetry,
  className = "",
}: CardErrorStateProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || retrying) return;
    try {
      setRetrying(true);
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <section
      role="alert"
      aria-live="polite"
      className={`animate-fade-soft motion-reduce:animate-none flex flex-col items-center py-10 text-center ${className}`}
    >
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-[3px] border border-danger/25 bg-danger/8 text-danger">
        <CloudOff className="size-5" aria-hidden />
      </span>
      <h3 className="font-sans text-sm font-700 uppercase tracking-[1px] text-fg-1">
        {title}
      </h3>
      <p className="mt-1.5 max-w-[34ch] text-sm leading-relaxed text-fg-2">
        {description}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          className="group mt-5 inline-flex items-center gap-2 rounded-[3px] border border-white/10 px-5 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-fg-2 transition-colors hover:border-accent/40 hover:text-fg-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`size-3.5 transition-transform duration-200 ${
              retrying
                ? "animate-spin motion-reduce:animate-none"
                : "group-hover:-rotate-90"
            }`}
            aria-hidden
          />
          {retrying ? "Retrying…" : "Try again"}
        </button>
      )}
    </section>
  );
}

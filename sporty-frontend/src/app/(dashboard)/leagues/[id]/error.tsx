"use client";

export default function LeagueError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card-surface flex flex-col items-center gap-4 p-10 text-center">
      <h1 className="font-sans text-xl font-700 uppercase tracking-[2px] text-fg-1">
        Something went wrong
      </h1>
      <p className="text-sm text-fg-3">
        {error.message || "This league couldn't be loaded."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-[3px] bg-accent px-5 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright"
      >
        Try Again
      </button>
    </div>
  );
}

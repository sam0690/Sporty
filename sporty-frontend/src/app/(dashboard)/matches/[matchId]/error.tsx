"use client";

export default function MatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
      <div className="card-surface w-full max-w-md p-8">
        <h1 className="font-sans text-xl font-700 uppercase tracking-[2px] text-fg-1">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-fg-3">
          {error.message || "This match couldn't be loaded."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-[3px] bg-accent px-5 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

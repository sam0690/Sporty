"use client";

type ErrorStateProps = {
  message?: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <section className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5 backdrop-blur-xl">
      <h2 className="text-base font-semibold text-red-100">
        Unable to load lineup
      </h2>
      <p className="mt-1 text-sm text-red-100/75">
        {message ?? "Something went wrong while fetching lineup data."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-full border border-red-400/20 bg-white/5 px-4 py-2 text-sm font-medium text-red-100 hover:bg-white/10"
      >
        Retry
      </button>
    </section>
  );
}

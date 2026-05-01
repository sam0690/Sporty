"use client";

type ErrorStateProps = {
  message?: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <section className="rounded-lg border border-danger/20 bg-danger/5 p-5">
      <h2 className="text-base font-semibold text-red-800">
        Unable to load lineup
      </h2>
      <p className="mt-1 text-sm text-danger">
        {message ?? "Something went wrong while fetching lineup data."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-full border border-danger/30 bg-white px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10"
      >
        Retry
      </button>
    </section>
  );
}

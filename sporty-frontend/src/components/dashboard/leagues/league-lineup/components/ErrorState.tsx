"use client";

type ErrorStateProps = {
  message?: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
      <h2 className="text-base font-semibold text-red-800">
        Unable to load lineup
      </h2>
      <p className="mt-1 text-sm text-red-700">
        {message ?? "Something went wrong while fetching lineup data."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        Retry
      </button>
    </section>
  );
}

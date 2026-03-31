"use client";

type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <section className="py-12 text-center">
      <div className="mx-auto mb-3 text-4xl" aria-hidden="true">🏆</div>
      <p className="text-text-secondary">{message}</p>
      <button
        type="button"
        className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-white transition-colors hover:bg-primary-600"
      >
        Invite Friends
      </button>
    </section>
  );
}

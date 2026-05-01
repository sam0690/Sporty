"use client";

type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <section className="py-12 text-center">
      <div className="mx-auto mb-3 text-4xl" aria-hidden="true">🏆</div>
      <p className="text-secondary">{message}</p>
      <button
        type="button"
        className="mt-4 rounded-lg bg-primary/100 px-4 py-2 text-white transition-colors hover:bg-primary/90"
      >
        Invite Friends
      </button>
    </section>
  );
}

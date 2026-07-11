"use client";

type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <section className="rounded-[3px] border border-white/8 bg-surface-3 py-12 text-center ">
      <div className="mx-auto mb-3 text-4xl" aria-hidden="true">
        🏆
      </div>
      <p className="text-fg-3">{message}</p>
    </section>
  );
}

"use client";

type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 py-12 text-center backdrop-blur-xl">
      <div className="mx-auto mb-3 text-4xl" aria-hidden="true">
        🏆
      </div>
      <p className="text-foreground/60">{message}</p>
    </section>
  );
}

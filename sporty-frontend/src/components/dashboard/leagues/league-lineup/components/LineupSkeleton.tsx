"use client";

export function LineupSkeleton() {
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="h-10 w-full rounded-lg bg-accent/30 animate-pulse" />
      <div className="h-24 w-full rounded-lg bg-accent/30 animate-pulse" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="h-6 w-32 rounded bg-accent/30 animate-pulse" />
          <div className="h-20 rounded-lg bg-accent/30 animate-pulse" />
          <div className="h-20 rounded-lg bg-accent/30 animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-6 w-32 rounded bg-accent/30 animate-pulse" />
          <div className="h-20 rounded-lg bg-accent/30 animate-pulse" />
        </div>
      </div>
      <div className="h-10 w-32 rounded bg-accent/30 animate-pulse" />
    </section>
  );
}

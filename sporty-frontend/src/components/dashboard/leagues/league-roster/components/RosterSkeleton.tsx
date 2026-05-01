"use client";

export function RosterSkeleton() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="h-10 w-full rounded-lg bg-accent/30 animate-pulse" />

      <div className="grid grid-cols-3 gap-4">
        <div className="h-20 rounded-lg bg-accent/30 animate-pulse" />
        <div className="h-20 rounded-lg bg-accent/30 animate-pulse" />
        <div className="h-20 rounded-lg bg-accent/30 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 rounded-lg bg-accent/30 animate-pulse" />
        <div className="h-24 rounded-lg bg-accent/30 animate-pulse" />
        <div className="h-24 rounded-lg bg-accent/30 animate-pulse" />
        <div className="h-24 rounded-lg bg-accent/30 animate-pulse" />
        <div className="h-24 rounded-lg bg-accent/30 animate-pulse" />
        <div className="h-24 rounded-lg bg-accent/30 animate-pulse" />
      </div>
    </section>
  );
}

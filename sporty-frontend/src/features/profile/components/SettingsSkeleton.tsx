"use client";

export function SettingsSkeleton() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-surface-3" />
        <div className="h-11 w-48 animate-pulse rounded bg-surface-3" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <div className="card-surface flex flex-col items-center gap-4 p-6">
          <div className="size-24 animate-pulse rounded-full bg-surface-3" />
          <div className="h-5 w-32 animate-pulse rounded bg-surface-3" />
          <div className="h-4 w-40 animate-pulse rounded bg-surface-3" />
        </div>

        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-surface space-y-4 p-5">
              <div className="h-4 w-24 animate-pulse rounded bg-surface-3" />
              <div className="h-10 w-full animate-pulse rounded bg-surface-3" />
              <div className="h-10 w-full animate-pulse rounded bg-surface-3" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

export function SettingsSkeleton() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex flex-wrap items-center gap-6">
        <div className="h-20 w-20 animate-pulse rounded-full bg-white/10" />
        <div className="space-y-2">
          <div className="h-8 w-56 animate-pulse rounded bg-white/10" />
          <div className="h-5 w-72 animate-pulse rounded bg-white/10" />
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
        <div className="h-10 w-full animate-pulse rounded bg-white/10" />
        <div className="h-10 w-full animate-pulse rounded bg-white/10" />
        <div className="h-20 w-full animate-pulse rounded bg-white/10" />
        <div className="h-10 w-24 animate-pulse rounded bg-white/10" />
      </div>
    </section>
  );
}

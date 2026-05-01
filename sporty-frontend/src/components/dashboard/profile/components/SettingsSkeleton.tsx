"use client";

export function SettingsSkeleton() {
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center gap-6">
        <div className="h-20 w-20 animate-pulse rounded-full bg-accent/30" />
        <div className="space-y-2">
          <div className="h-8 w-56 animate-pulse rounded bg-accent/30" />
          <div className="h-5 w-72 animate-pulse rounded bg-accent/30" />
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-md border border-border bg-[#F4F4F9] p-6">
        <div className="h-10 w-full animate-pulse rounded bg-accent/30" />
        <div className="h-10 w-full animate-pulse rounded bg-accent/30" />
        <div className="h-20 w-full animate-pulse rounded bg-accent/30" />
        <div className="h-10 w-24 animate-pulse rounded bg-accent/30" />
      </div>
    </section>
  );
}

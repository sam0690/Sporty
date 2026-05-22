"use client";

import { useRouter } from "next/navigation";

export function EmptyState() {
  const router = useRouter();

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 py-14 text-center backdrop-blur-xl">
      <div className="mx-auto mb-3 text-4xl text-slate-400" aria-hidden="true">
        🏆
      </div>
      <h2 className="text-lg font-medium text-foreground">No leagues yet</h2>
      <p className="mt-2 text-sm text-slate-400">
        Join a league to start playing
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/join-league")}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground transition-colors hover:bg-white/8"
        >
          Join League
        </button>
        <button
          type="button"
          onClick={() => router.push("/create-league")}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground transition-colors hover:bg-white/8"
        >
          Create League
        </button>
      </div>
    </section>
  );
}

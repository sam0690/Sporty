"use client";

import { useRouter } from "next/navigation";

export function EmptyState() {
  const router = useRouter();

  return (
    <section className="rounded-[3px] border border-white/8 bg-surface-3 py-14 text-center ">
      <div className="mx-auto mb-3 text-4xl text-fg-3" aria-hidden="true">
        🏆
      </div>
      <h2 className="text-lg text-fg-1">No leagues yet</h2>
      <p className="mt-2 text-sm text-fg-3">
        Join a league to start playing
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/join-league")}
          className="rounded-[3px] border border-white/8 bg-surface-3 px-4 py-2 text-sm text-fg-1 transition-colors hover:bg-surface-3"
        >
          Join League
        </button>
        <button
          type="button"
          onClick={() => router.push("/create-league")}
          className="rounded-[3px] border border-white/8 bg-surface-3 px-4 py-2 text-sm text-fg-1 transition-colors hover:bg-surface-3"
        >
          Create League
        </button>
      </div>
    </section>
  );
}

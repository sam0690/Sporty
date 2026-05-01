"use client";

import { useRouter } from "next/navigation";

export function EmptyState() {
  const router = useRouter();

  return (
    <section className="rounded-lg border border-accent/20 py-14 text-center">
      <div className="mx-auto mb-3 text-4xl text-secondary/60" aria-hidden="true">🏆</div>
      <h2 className="text-lg font-medium text-secondary">No leagues yet</h2>
      <p className="mt-2 text-sm text-secondary">Join a league to start playing</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/join-league")}
          className="rounded-md border border-border px-4 py-2 text-sm text-black transition-colors hover:border-primary-500 hover:text-primary-500"
        >
          Join League
        </button>
        <button
          type="button"
          onClick={() => router.push("/create-league")}
          className="rounded-md border border-border px-4 py-2 text-sm text-black transition-colors hover:border-primary-500 hover:text-primary-500"
        >
          Create League
        </button>
      </div>
    </section>
  );
}

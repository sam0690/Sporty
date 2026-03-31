"use client";

import { useRouter } from "next/navigation";

export function EmptyState() {
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-gray-100 py-14 text-center">
      <div className="mx-auto mb-3 text-4xl text-gray-400" aria-hidden="true">🏆</div>
      <h2 className="text-lg font-medium text-gray-600">No leagues yet</h2>
      <p className="mt-2 text-sm text-gray-500">Join a league to start playing</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/join-league")}
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-primary-500 hover:text-primary-500"
        >
          Join League
        </button>
        <button
          type="button"
          onClick={() => router.push("/create-league")}
          className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 transition-colors hover:border-primary-500 hover:text-primary-500"
        >
          Create League
        </button>
      </div>
    </section>
  );
}

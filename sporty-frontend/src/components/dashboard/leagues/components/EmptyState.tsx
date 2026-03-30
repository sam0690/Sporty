"use client";

import { useRouter } from "next/navigation";

export function EmptyState() {
  const router = useRouter();

  return (
    <section className="py-12 text-center">
      <div className="mx-auto mb-3 text-4xl" aria-hidden="true">🏆</div>
      <h2 className="text-xl font-semibold text-text-primary">You haven't joined any leagues yet</h2>
      <p className="mt-2 text-text-secondary">Join a league to start your fantasy sports journey</p>
      <button
        type="button"
        onClick={() => router.push("/join-league")}
        className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-white transition-colors hover:bg-primary-600"
      >
        Join a League
      </button>
    </section>
  );
}

"use client";

import Link from "next/link";

export function EmptyLeagues() {
  return (
    <section className="py-16 text-center">
      <div className="mb-4 text-5xl text-gray-300" aria-hidden="true">🏆</div>
      <h3 className="font-medium text-gray-600">No leagues yet</h3>
      <p className="text-sm text-gray-400">Join a league to start playing</p>
      <Link
        href="/join-league"
        className="mt-4 inline-flex rounded-full border border-primary-500 px-6 py-2 text-primary-500 hover:bg-primary-50"
      >
        Join League
      </Link>
    </section>
  );
}

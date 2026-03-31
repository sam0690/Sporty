"use client";

import { useRouter } from "next/navigation";

type LeaguesHeaderProps = {
  userName: string;
};

export function LeaguesHeader({ userName }: LeaguesHeaderProps) {
  const router = useRouter();

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm text-gray-500">Welcome back, {userName}</p>
        <h1 className="text-2xl font-light tracking-tight text-gray-900">My Leagues</h1>
        <p className="mt-1 text-sm text-gray-500">Your fantasy leagues at a glance</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
    </header>
  );
}

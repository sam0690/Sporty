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
        <p className="text-sm text-secondary">Welcome back, {userName}</p>
        <h1 className="text-2xl font-bold tracking-tight text-black">My Leagues</h1>
        <p className="mt-1 text-sm text-secondary">Your fantasy leagues at a glance</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
    </header>
  );
}

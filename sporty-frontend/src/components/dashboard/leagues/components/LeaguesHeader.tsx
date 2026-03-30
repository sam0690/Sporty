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
        <p className="text-sm text-text-secondary">Welcome back, {userName}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">My Leagues</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage and track all your fantasy leagues</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/join-league")}
          className="rounded-lg bg-primary-500 px-4 py-2 text-white transition-colors hover:bg-primary-600"
        >
          Join League
        </button>
        <button
          type="button"
          onClick={() => router.push("/create-league")}
          className="rounded-lg border border-primary-500 px-4 py-2 text-primary-500 transition-colors hover:bg-primary-50"
        >
          Create League
        </button>
      </div>
    </header>
  );
}

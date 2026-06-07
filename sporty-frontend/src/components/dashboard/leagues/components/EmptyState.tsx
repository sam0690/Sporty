"use client";

import { useRouter } from "next/navigation";

export function EmptyState() {
  const router = useRouter();

  return (
    <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] py-14 text-center ">
      <div className="mx-auto mb-3 text-4xl text-[#555560]" aria-hidden="true">
        🏆
      </div>
      <h2 className="text-lg text-[#f0f0f0]">No leagues yet</h2>
      <p className="mt-2 text-sm text-[#555560]">
        Join a league to start playing
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/join-league")}
          className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 text-sm text-[#f0f0f0] transition-colors hover:bg-[#1d1d26]"
        >
          Join League
        </button>
        <button
          type="button"
          onClick={() => router.push("/create-league")}
          className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 text-sm text-[#f0f0f0] transition-colors hover:bg-[#1d1d26]"
        >
          Create League
        </button>
      </div>
    </section>
  );
}

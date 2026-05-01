"use client";

import Link from "next/link";

type TransferFieldsProps = {
  leagueId: string;
};

export function TransferFields({ leagueId }: TransferFieldsProps) {
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-800">
        Transfer window is active
      </p>
      <p className="mt-1 text-sm text-emerald-700">
        You can make player swaps for this league right now.
      </p>
      <Link
        href={`/transfers?leagueId=${leagueId}`}
        className="mt-3 inline-flex rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
      >
        Open Transfer Fields
      </Link>
    </section>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight, Check, ListChecks, X } from "lucide-react";

type SuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  teamName: string;
};

export function SuccessModal({
  isOpen,
  onClose,
  leagueId,
  teamName,
}: SuccessModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-fade-in-scale w-full max-w-md overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
        {/* volt accent strip */}
        <div className="h-1 bg-[#e8fb25]" />

        <div className="p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.12)]">
            <Check size={26} strokeWidth={3} className="text-[#e8fb25]" />
          </div>

          <p className="section-label mt-4">Team Created</p>
          <h2 className="mt-1 font-bebas text-4xl leading-none tracking-[2px] text-[#f0f0f0]">
            {teamName}
          </h2>
          <p className="mt-2 text-xs text-[#555560]">
            You&apos;re ready to start playing.
          </p>

          <div className="mt-6 space-y-2">
            <Link
              href={`/leagues/${leagueId}`}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#e8fb25] px-6 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-[#f2ff5a]"
            >
              Go to League
              <ArrowRight size={16} />
            </Link>
            <Link
              href={`/leagues/${leagueId}/lineup`}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-6 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-[#f0f0f0] transition-colors hover:border-[rgba(232,251,37,0.3)]"
            >
              <ListChecks size={15} />
              Set Lineup
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] px-6 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#555560] transition-colors hover:text-[#9a9aa5]"
            >
              <X size={14} />
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      <div className="animate-fade-in-scale w-full max-w-md overflow-hidden rounded-[3px] border border-white/8 bg-surface-1">
        {/* volt accent strip */}
        <div className="h-1 bg-accent" />

        <div className="p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-accent/30 bg-accent/12">
            <Check size={26} strokeWidth={3} className="text-accent" />
          </div>

          <p className="section-label mt-4">Team Created</p>
          <h2 className="mt-1 font-bebas text-4xl leading-none tracking-[2px] text-fg-1">
            {teamName}
          </h2>
          <p className="mt-2 text-xs text-fg-3">
            You&apos;re ready to start playing.
          </p>

          <div className="mt-6 space-y-2">
            <Link
              href={`/leagues/${leagueId}`}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-accent px-6 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright"
            >
              Go to League
              <ArrowRight size={16} />
            </Link>
            <Link
              href={`/leagues/${leagueId}/lineup`}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-white/8 bg-surface-3 px-6 py-2.5 font-barlow-condensed text-sm font-700 uppercase tracking-[1.5px] text-fg-1 transition-colors hover:border-accent/30"
            >
              <ListChecks size={15} />
              Set Lineup
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] px-6 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-fg-3 transition-colors hover:text-fg-2"
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

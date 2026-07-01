"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-fade-in-scale w-full max-w-md overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]">
        {/* volt accent strip */}
        <div className="h-1 bg-[#DC2626]" />

        <div className="p-6 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full border border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.12)]">
            <Check size={26} strokeWidth={3} className="text-[#DC2626]" />
          </div>

          <p className="section-label mt-4">Team Created</p>
          <h2 className="mt-1 font-bebas text-4xl leading-none tracking-[2px] text-[#0B1220]">
            {teamName}
          </h2>
          <p className="mt-2 text-xs text-[#6B7280]">
            You&apos;re ready to start playing.
          </p>

          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={() => router.push(`/leagues/${leagueId}`)}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#DC2626] px-6 py-2.5 font-barlow-condensed text-sm font-bold uppercase tracking-[1.5px] text-black transition-colors hover:bg-[#DC2626]"
            >
              Go to League
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => router.push(`/leagues/${leagueId}/lineup`)}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-6 py-2.5 font-barlow-condensed text-sm font-bold uppercase tracking-[1.5px] text-[#0B1220] transition-colors hover:border-[rgba(220,38,38,0.3)]"
            >
              <ListChecks size={15} />
              Set Lineup
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-[3px] px-6 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#6B7280] transition-colors hover:text-[#6B7280]"
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

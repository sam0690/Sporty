"use client";

import { CopyButton } from "@/components/dashboard/leagues/invite-friends/components/CopyButton";

type ShareLinksProps = {
  shareUrl: string;
};

export function ShareLinks({ shareUrl }: ShareLinksProps) {
  return (
    <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
      <p className="text-sm text-[#555560]">Share Link</p>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3">
        <span className="truncate text-sm text-[#f0f0f0]">{shareUrl}</span>
        <CopyButton value={shareUrl} label="Share link" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-[3px] border border-[rgba(255,255,255,0.08)] px-4 py-2 text-center text-sm text-[#f0f0f0] transition-colors hover:bg-[#1d1d26]"
        >
          Share on WhatsApp
        </a>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-[3px] border border-[rgba(255,255,255,0.08)] px-4 py-2 text-center text-sm text-[#f0f0f0] transition-colors hover:bg-[#1d1d26]"
        >
          Share on Telegram
        </a>
      </div>
    </div>
  );
}

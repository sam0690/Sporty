"use client";

import { CopyButton } from "@/components/dashboard/leagues/invite-friends/components/CopyButton";

type ShareLinksProps = {
  shareUrl: string;
};

export function ShareLinks({ shareUrl }: ShareLinksProps) {
  return (
    <div className="rounded-lg border border-accent/20 bg-white p-5">
      <p className="text-sm text-secondary">Share Link</p>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-border bg-[#F4F4F9] px-4 py-3">
        <span className="truncate text-sm text-black">{shareUrl}</span>
        <CopyButton value={shareUrl} label="Share link" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-border px-4 py-2 text-center text-sm text-black hover:bg-[#F4F4F9]"
        >
          Share on WhatsApp
        </a>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-border px-4 py-2 text-center text-sm text-black hover:bg-[#F4F4F9]"
        >
          Share on Telegram
        </a>
      </div>
    </div>
  );
}

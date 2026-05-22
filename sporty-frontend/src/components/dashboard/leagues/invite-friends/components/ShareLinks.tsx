"use client";

import { CopyButton } from "@/components/dashboard/leagues/invite-friends/components/CopyButton";

type ShareLinksProps = {
  shareUrl: string;
};

export function ShareLinks({ shareUrl }: ShareLinksProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <p className="text-sm text-foreground/60">Share Link</p>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-4 py-3">
        <span className="truncate text-sm text-foreground">{shareUrl}</span>
        <CopyButton value={shareUrl} label="Share link" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/10 px-4 py-2 text-center text-sm text-foreground transition-colors hover:bg-white/10"
        >
          Share on WhatsApp
        </a>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/10 px-4 py-2 text-center text-sm text-foreground transition-colors hover:bg-white/10"
        >
          Share on Telegram
        </a>
      </div>
    </div>
  );
}

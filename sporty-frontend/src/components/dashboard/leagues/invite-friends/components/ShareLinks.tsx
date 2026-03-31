"use client";

import { CopyButton } from "@/components/dashboard/leagues/invite-friends/components/CopyButton";

type ShareLinksProps = {
  shareUrl: string;
};

export function ShareLinks({ shareUrl }: ShareLinksProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <p className="text-sm text-gray-600">Share Link</p>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <span className="truncate text-sm text-gray-700">{shareUrl}</span>
        <CopyButton value={shareUrl} label="Share link" />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-gray-200 px-4 py-2 text-center text-sm text-gray-700 hover:bg-gray-50"
        >
          Share on WhatsApp
        </a>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-gray-200 px-4 py-2 text-center text-sm text-gray-700 hover:bg-gray-50"
        >
          Share on Telegram
        </a>
      </div>
    </div>
  );
}

"use client";

import { Mail, MessageCircle, Send, X } from "lucide-react";
import { CopyButton } from "@/components/dashboard/leagues/invite-friends/components/CopyButton";

type ShareLinksProps = {
  shareUrl: string;
};

const SHARE_TARGETS: Array<{
  label: string;
  icon: typeof MessageCircle;
  href: (url: string) => string;
  hover: string;
}> = [
  {
    label: "WhatsApp",
    icon: MessageCircle,
    href: (url) => `https://wa.me/?text=${encodeURIComponent(url)}`,
    hover: "hover:border-[rgba(37,211,102,0.5)] hover:text-[#25d366]",
  },
  {
    label: "Telegram",
    icon: Send,
    href: (url) => `https://t.me/share/url?url=${encodeURIComponent(url)}`,
    hover: "hover:border-[rgba(0,136,204,0.5)] hover:text-[#37aee2]",
  },
  {
    label: "X",
    icon: X,
    href: (url) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        "Join my Sporty league! " + url,
      )}`,
    hover: "hover:border-[rgba(255,255,255,0.4)] hover:text-[#f0f0f0]",
  },
  {
    label: "Email",
    icon: Mail,
    href: (url) =>
      `mailto:?subject=${encodeURIComponent(
        "Join my Sporty league",
      )}&body=${encodeURIComponent(url)}`,
    hover: "hover:border-[rgba(232,251,37,0.5)] hover:text-[#e8fb25]",
  },
];

export function ShareLinks({ shareUrl }: ShareLinksProps) {
  return (
    <div className="overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] animate-fade-soft">
      <div className="border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
        <p className="section-label">Share Link</p>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3">
          <span className="truncate text-sm text-[#9a9aa5]">{shareUrl}</span>
          <CopyButton value={shareUrl} label="Share link" />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SHARE_TARGETS.map(({ label, icon: Icon, href, hover }) => (
            <a
              key={label}
              href={href(shareUrl)}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center justify-center gap-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#9a9aa5] transition-colors ${hover}`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

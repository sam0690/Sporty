"use client";

import type { ComponentType } from "react";
import { MessageCircle, Send, Share2, Mail } from "lucide-react";
import { CopyButton } from "@/components/dashboard/leagues/invite-friends/components/CopyButton";

type ShareLinksProps = {
  shareUrl: string;
};

const SHARE_TARGETS: Array<{
  label: string;
  Icon: ComponentType<{ className?: string }>;
  href: (url: string) => string;
  hover: string;
}> = [
  {
    label: "WhatsApp",
    Icon: MessageCircle,
    href: (url) => `https://wa.me/?text=${encodeURIComponent(url)}`,
    hover: "hover:border-[rgba(37,211,102,0.5)] hover:text-[#25d366]",
  },
  {
    label: "Telegram",
    Icon: Send,
    href: (url) => `https://t.me/share/url?url=${encodeURIComponent(url)}`,
    hover: "hover:border-[rgba(0,136,204,0.5)] hover:text-[#37aee2]",
  },
  {
    label: "X",
    Icon: Share2,
    href: (url) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        "Join my Sporty league! " + url,
      )}`,
    hover: "hover:border-ink hover:text-ink",
  },
  {
    label: "Email",
    Icon: Mail,
    href: (url) =>
      `mailto:?subject=${encodeURIComponent(
        "Join my Sporty league",
      )}&body=${encodeURIComponent(url)}`,
    hover: "hover:border-primary/50 hover:text-primary",
  },
];

export function ShareLinks({ shareUrl }: ShareLinksProps) {
  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-border px-5 py-3">
        <p className="section-label">Share Link</p>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted px-4 py-3">
          <span className="truncate text-sm text-ink-muted">{shareUrl}</span>
          <CopyButton value={shareUrl} label="Share link" />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SHARE_TARGETS.map(({ label, Icon, href, hover }) => (
            <a
              key={label}
              href={href(shareUrl)}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center justify-center gap-2 rounded-sm border border-border bg-surface-muted px-4 py-2.5 font-condensed text-xs font-bold uppercase tracking-[0.06em] text-ink-muted transition-colors ${hover}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

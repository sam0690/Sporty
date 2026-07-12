"use client";

import { Share2 } from "lucide-react";
import { toastifier } from "@/lib/toastifier";

type ShareProfileButtonProps = {
  /** Public path to share, e.g. "/p/{playerId}" or "/u/{userId}". */
  path: string;
  label?: string;
  className?: string;
};

export function ShareProfileButton({
  path,
  label = "Share",
  className,
}: ShareProfileButtonProps) {
  const handleShare = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      toastifier.success("Link copied to clipboard");
    } catch {
      toastifier.error("Couldn't copy link — copy it from the address bar instead");
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={label ? undefined : "Copy shareable profile link"}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-[3px] border border-white/12 px-3 py-1.5 font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2 transition-colors hover:border-white/28 hover:text-fg-1"
      }
    >
      <Share2 className="size-3.5" />
      {label}
    </button>
  );
}

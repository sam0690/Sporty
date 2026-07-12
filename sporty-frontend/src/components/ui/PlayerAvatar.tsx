"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/utils/classUtils";

export interface PlayerAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = {
  sm: { box: "h-8 w-8", text: "text-[10px]", px: 32 },
  md: { box: "h-11 w-11", text: "text-xs", px: 44 },
  lg: { box: "h-16 w-16", text: "text-xl", px: 64 },
  xl: { box: "h-24 w-24 sm:h-28 sm:w-28", text: "text-3xl sm:text-4xl", px: 112 },
} as const;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function PlayerAvatar({
  name,
  photoUrl,
  size = "md",
  className,
}: PlayerAvatarProps) {
  const [failed, setFailed] = useState(false);
  const { box, text, px } = SIZE_MAP[size];
  const showImage = Boolean(photoUrl) && !failed;

  return (
    <div
      className={cn(
        box,
        "shrink-0 overflow-hidden rounded-[3px] border border-accent/20 bg-accent/8 flex items-center justify-center font-sans font-700 tracking-[1px] text-accent",
        text,
        className,
      )}
    >
      {showImage ? (
        <Image
          src={photoUrl as string}
          alt={name}
          width={px}
          height={px}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}

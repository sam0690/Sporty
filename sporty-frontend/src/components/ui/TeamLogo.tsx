"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/utils/classUtils";

export interface TeamLogoProps {
  teamName: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { box: "h-5 w-5", text: "text-[8px]", px: 20 },
  md: { box: "h-7 w-7", text: "text-[10px]", px: 28 },
  lg: { box: "h-14 w-14 sm:h-16 sm:w-16", text: "text-xl sm:text-2xl", px: 64 },
} as const;

function getAbbreviation(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function TeamLogo({
  teamName,
  logoUrl,
  size = "sm",
  className,
}: TeamLogoProps) {
  const [failed, setFailed] = useState(false);
  const { box, text, px } = SIZE_MAP[size];
  const showImage = Boolean(logoUrl) && !failed;

  return (
    <span
      title={teamName}
      className={cn(
        box,
        "shrink-0 overflow-hidden rounded-full border border-white/10 bg-surface-3 inline-flex items-center justify-center font-barlow-condensed font-700 text-fg-2",
        text,
        className,
      )}
    >
      {showImage ? (
        <Image
          src={logoUrl as string}
          alt={teamName}
          width={px}
          height={px}
          className="h-full w-full object-contain p-0.5"
          onError={() => setFailed(true)}
        />
      ) : (
        getAbbreviation(teamName)
      )}
    </span>
  );
}

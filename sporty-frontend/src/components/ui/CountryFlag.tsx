"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/utils/classUtils";

export interface CountryFlagProps {
  /** Country name as stored on the player, e.g. "France". Used as the label. */
  nationality?: string | null;
  /** Public R2 URL from the API's computed `flag_url`. */
  flagUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  // 3:2 is flagcdn's aspect ratio; matching it avoids letterboxing.
  sm: { box: "h-3 w-[18px]", w: 18, h: 12 },
  md: { box: "h-4 w-6", w: 24, h: 16 },
  lg: { box: "h-6 w-9", w: 36, h: 24 },
} as const;

/**
 * A national flag served from our own R2 bucket.
 *
 * Renders nothing when there is no flag: plenty of players have no
 * nationality recorded, and a handful have one we cannot map to a flag code,
 * so callers pair this with the nationality text rather than relying on it.
 */
export function CountryFlag({
  nationality,
  flagUrl,
  size = "sm",
  className,
}: CountryFlagProps) {
  const [failed, setFailed] = useState(false);
  const { box, w, h } = SIZE_MAP[size];

  if (!flagUrl || failed) {
    return null;
  }

  return (
    <span
      title={nationality ?? undefined}
      className={cn(
        box,
        "inline-block shrink-0 overflow-hidden rounded-[2px] border border-white/10",
        className,
      )}
    >
      <Image
        src={flagUrl}
        alt={nationality ? `${nationality} flag` : ""}
        width={w}
        height={h}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
        unoptimized
      />
    </span>
  );
}

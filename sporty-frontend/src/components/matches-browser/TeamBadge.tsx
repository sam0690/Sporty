import { useState } from "react";
import Image from "next/image";
import { teamIdentity } from "@/lib/teamIdentity";

type TeamBadgeProps = {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  /** Overrides the club's own colour. Pass this wherever both teams in a
   *  fixture are on screen together, so two clubs sharing a brand colour don't
   *  render identical badges — see matchIdentities. */
  color?: string;
};

const SIZE_CLASS: Record<NonNullable<TeamBadgeProps["size"]>, string> = {
  sm: "size-7 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-14 text-xl sm:size-16 sm:text-2xl",
};

const IMAGE_PX: Record<NonNullable<TeamBadgeProps["size"]>, number> = {
  sm: 28,
  md: 36,
  lg: 64,
};

export function TeamBadge({ name, logoUrl, size = "sm", color }: TeamBadgeProps) {
  const identity = teamIdentity(name);
  const badgeColor = color ?? identity.color;
  const { initials } = identity;
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !failed;

  return (
    <span
      title={name}
      className={`grid shrink-0 place-items-center overflow-hidden rounded-[3px] bg-surface-2 font-display leading-none tracking-[-0.02em] text-fg-1 ${SIZE_CLASS[size]}`}
      style={{ border: `2px solid ${badgeColor}` }}
      aria-hidden={!showImage}
    >
      {showImage ? (
        <Image
          src={logoUrl as string}
          alt={name}
          width={IMAGE_PX[size]}
          height={IMAGE_PX[size]}
          className="h-full w-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}

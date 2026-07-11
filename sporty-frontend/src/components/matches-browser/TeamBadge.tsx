import { useState } from "react";
import Image from "next/image";
import { teamIdentity } from "@/lib/teamIdentity";

type TeamBadgeProps = {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
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

export function TeamBadge({ name, logoUrl, size = "sm" }: TeamBadgeProps) {
  const { color, initials } = teamIdentity(name);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !failed;

  return (
    <span
      title={name}
      className={`grid shrink-0 place-items-center overflow-hidden rounded-[3px] font-display leading-none tracking-[-0.02em] ${SIZE_CLASS[size]}`}
      style={{
        color,
        background: `${color}14`,
        border: `1px solid ${color}40`,
      }}
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

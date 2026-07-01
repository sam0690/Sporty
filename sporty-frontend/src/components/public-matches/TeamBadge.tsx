import { teamIdentity } from "@/lib/teamIdentity";

type TeamBadgeProps = {
  name: string;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASS: Record<NonNullable<TeamBadgeProps["size"]>, string> = {
  sm: "size-7 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-14 text-xl sm:size-16 sm:text-2xl",
};

export function TeamBadge({ name, size = "sm" }: TeamBadgeProps) {
  const { color, initials } = teamIdentity(name);
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-[8px] font-bebas leading-none tracking-[1px] ${SIZE_CLASS[size]}`}
      style={{
        color,
        background: `linear-gradient(160deg, ${color}2e, ${color}0d)`,
        border: `1px solid ${color}59`,
        boxShadow: `0 0 16px ${color}1f, 0 1px 0 ${color}33 inset`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

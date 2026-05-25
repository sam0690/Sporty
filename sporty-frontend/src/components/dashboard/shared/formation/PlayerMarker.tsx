import {
  getSportAccentClass,
  getSportIcon,
} from "@/components/dashboard/shared/formation/sportRegistry";

type PlayerMarkerProps = {
  name: string;
  position: string;
  sport?: string | null;
  team?: string | null;
  points?: number | null;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  className?: string;
};

export function PlayerMarker({
  name,
  position,
  sport,
  team,
  points,
  isCaptain = false,
  isViceCaptain = false,
  className = "",
}: PlayerMarkerProps) {
  return (
    <div className={`flex flex-col items-center text-white ${className}`}>
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/95 text-xl shadow-[0_10px_24px_rgba(0,0,0,0.18)] sm:h-16 sm:w-16">
        <span aria-hidden="true">{getSportIcon(sport)}</span>
        {isCaptain ? (
          <span className="absolute -left-1.5 -top-1.5 rounded-full border border-yellow-200 bg-yellow-300 px-1.5 py-0.5 text-[9px] font-bold leading-none text-yellow-900">
            C
          </span>
        ) : null}
        {isViceCaptain ? (
          <span className="absolute -right-1.5 -top-1.5 rounded-full border border-sky-200 bg-sky-300 px-1.5 py-0.5 text-[9px] font-bold leading-none text-sky-900">
            VC
          </span>
        ) : null}
      </div>

      <p className="mt-1 w-24 truncate text-center text-xs font-semibold text-foreground sm:w-28">
        {name}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-white/70">
        {position}
      </p>
      {team ? (
        <p className="w-24 truncate text-center text-[10px] text-white/70 sm:w-28">
          {team}
        </p>
      ) : null}
      <p className="text-[10px] text-white/70">
        {typeof points === "number" ? `${points} pts` : "0 pts"}
      </p>
      <span
        className={`mt-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${getSportAccentClass(sport)}`}
      >
        {sport || "mixed"}
      </span>
    </div>
  );
}

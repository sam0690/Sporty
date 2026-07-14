import { PlayerAvatar } from "@/components/ui";
import { getSportAccentClass } from "@/lib/formation/sportRegistry";

type PlayerMarkerProps = {
  name: string;
  position: string;
  sport?: string | null;
  team?: string | null;
  photoUrl?: string | null;
  points?: number | null;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  className?: string;
};

export function PlayerMarker({
  name,
  position,
  sport,
  photoUrl,
  points,
  isCaptain = false,
  isViceCaptain = false,
  className = "",
}: Omit<PlayerMarkerProps, "team">) {
  return (
    <div
      className={`group flex flex-col items-center justify-center transition-all duration-300 ease-out ${className}`}
    >
      <div className="relative">
        {/* Photo tile — same treatment as the lineup pitch markers */}
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[3px] border border-white/20 bg-white transition-transform duration-200 group-hover:scale-105 sm:h-12 sm:w-12">
          <PlayerAvatar
            name={name}
            photoUrl={photoUrl}
            size="md"
            className="!h-full !w-full !rounded-none !border-0 !bg-transparent"
          />
        </div>

        {/* Small Floating Overlays (C/VC) - Top left */}
        {isCaptain ? (
          <div className="absolute -left-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-[3px] border border-yellow-200 bg-yellow-400 font-700 text-yellow-950 shadow-sm ring-1 ring-white/10 text-[8px] sm:h-5 sm:w-5 sm:text-[10px]">
            C
          </div>
        ) : isViceCaptain ? (
          <div className="absolute -left-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-[3px] border border-sky-300 bg-sky-400 font-700 text-sky-950 shadow-sm ring-1 ring-white/10 text-[8px] sm:h-5 sm:w-5 sm:text-[10px]">
            VC
          </div>
        ) : null}

        {/* Points - Top right */}
        {/* Points - Top right */}
        {typeof points === "number" && (
          <div
            className={`absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-[3px] border shadow-sm ring-1 ring-white/10 text-[8px] font-700 sm:h-5 sm:w-5 sm:text-[9px] ${getSportAccentClass(
              sport,
            )}`}
          >
            {points}
          </div>
        )}
      </div>

      {/* Name Label */}
      <div className="relative mt-1.5 flex w-full flex-col items-center">
        <div className="flex w-16 flex-col items-center sm:w-20">
          <p className="w-full truncate rounded-sm bg-black/60 px-1 py-0.5 text-center text-[9px] font-700 text-white backdrop-blur-[2px] sm:text-[10px]">
            {name}
          </p>
          <p className="mt-0.5 text-[8px] font-600 uppercase tracking-[2px] text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] sm:text-[9px]">
            {position}
          </p>
        </div>
      </div>
    </div>
  );
}

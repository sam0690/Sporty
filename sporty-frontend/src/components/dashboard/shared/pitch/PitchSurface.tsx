import type { ReactNode } from "react";

type PitchSurfaceProps = {
  children: ReactNode;
  className?: string;
};

export function PitchSurface({ children, className = "" }: PitchSurfaceProps) {
  return (
    <div
      className={`relative mx-auto aspect-3/4 w-full overflow-hidden rounded-3xl border border-white/10 bg-linear-to-b from-[#1a4d2e] to-[#0f3a22] shadow-[0_28px_80px_rgba(0,0,0,0.35)] ${className}`}
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-[12%] w-[34%] -translate-x-1/2 border border-white/20" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-[12%] w-[34%] -translate-x-1/2 border border-white/20" />
      <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/20" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 sm:h-24 sm:w-24" />

      {children}
    </div>
  );
}

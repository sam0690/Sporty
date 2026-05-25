import type { CSSProperties, ReactNode } from "react";

type PitchRendererProps = {
  children: ReactNode;
  className?: string;
};

export function PitchRenderer({
  children,
  className = "",
}: PitchRendererProps) {
  const style: CSSProperties = {
    aspectRatio: "3 / 4",
  };

  return (
    <div
      style={style}
      className={`relative mx-auto w-full overflow-hidden rounded-3xl border border-white/10 bg-linear-to-b from-[#1a4d2e] via-[#134225] to-[#0c311c] shadow-[0_28px_80px_rgba(0,0,0,0.35)] ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-[12%] top-[7%] h-[14%] rounded-2xl border border-white/15" />
      <div className="pointer-events-none absolute inset-x-[12%] bottom-[7%] h-[14%] rounded-2xl border border-white/15" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
      <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/15" />
      <div className="pointer-events-none absolute left-1/2 top-[8%] bottom-[8%] w-px -translate-x-1/2 bg-white/10" />
      {children}
    </div>
  );
}

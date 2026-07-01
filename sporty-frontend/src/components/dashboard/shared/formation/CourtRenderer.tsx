import type { ReactNode } from "react";

type CourtRendererProps = {
  children: ReactNode;
  className?: string;
};

export function CourtRenderer({
  children,
  className = "",
}: CourtRendererProps) {
  return (
    <div
      className={`relative mx-auto aspect-4/5 w-full overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-linear-to-b from-[#162b5c] via-[#0f224c] to-[#09152e]  ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-[13%] bottom-[9%] top-[16%] rounded-[3px] border border-[rgba(11,18,32,0.12)]" />
      <div className="pointer-events-none absolute left-1/2 top-[17%] h-[17%] w-[34%] -translate-x-1/2 rounded-b-4xl border border-[rgba(11,18,32,0.12)] border-t-0" />
      <div className="pointer-events-none absolute left-1/2 top-[16%] h-[10%] w-[10%] -translate-x-1/2 rounded-[3px] border border-[rgba(11,18,32,0.12)]" />
      <div className="pointer-events-none absolute bottom-[12%] left-1/2 h-[18%] w-[44%] -translate-x-1/2 rounded-[3px] border border-[rgba(11,18,32,0.12)]" />
      <div className="pointer-events-none absolute left-1/2 top-[50%] h-px w-full -translate-y-1/2 bg-[#F3F4F7]" />
      {children}
    </div>
  );
}

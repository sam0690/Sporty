import Image from "next/image";
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
      className={`relative mx-auto aspect-19/34 w-full overflow-hidden rounded-[3px] border border-white/8 bg-[#09152e] ${className}`}
    >
      <Image
        src="/images/courts/basketball-court.png"
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 480px"
      />
      {children}
    </div>
  );
}

import Image from "next/image";
import type { ReactNode } from "react";

type PitchRendererProps = {
  children: ReactNode;
  className?: string;
};

export function PitchRenderer({
  children,
  className = "",
}: PitchRendererProps) {
  return (
    <div
      className={`relative mx-auto aspect-19/34 w-full overflow-hidden rounded-[3px] border border-white/8 bg-[#0c311c] ${className}`}
    >
      <Image
        src="/images/courts/football-pitch.png"
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 480px"
      />
      {children}
    </div>
  );
}

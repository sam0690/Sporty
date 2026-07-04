import Image from "next/image";
import type { ReactNode } from "react";

type MultisportRendererProps = {
  children: ReactNode;
  className?: string;
};

export function MultisportRenderer({
  children,
  className = "",
}: MultisportRendererProps) {
  return (
    <div
      className={`relative mx-auto aspect-331/594 w-full overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0c1f18] ${className}`}
    >
      <Image
        src="/images/courts/multisport-court.png"
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 480px"
      />
      {children}
    </div>
  );
}

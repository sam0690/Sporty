import Image from "next/image";
import type { LandingHeroVisual } from "@/components/landing/landing-hero/types";

type RightContentProps = {
  visual: LandingHeroVisual;
};

export function RightContent({ visual }: RightContentProps) {
  return (
    <div className="relative aspect-16/11 overflow-hidden rounded-2xl border border-surface-200 shadow-dropdown">
      <Image
        src={visual.imageSrc}
        alt={visual.imageAlt}
        fill
        priority
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 50vw"
      />
      <div className="absolute inset-0 bg-linear-to-b from-primary/10 via-transparent to-primary/70" />

      <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/25 bg-surface/15 p-3 backdrop-blur-md sm:p-4">
        <p className="text-sm font-medium text-white">
          {visual.nextMatchLabel}
        </p>
        <div className="mt-2 h-2 w-full rounded-full bg-white/30">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${visual.progressPercent}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={visual.progressPercent}
            aria-label="Next match progress"
          />
        </div>
      </div>
    </div>
  );
}

import Image from "next/image";
import type { LandingHeroVisual } from "@/components/landing/landing-hero/types";

type RightContentProps = {
  visual: LandingHeroVisual;
};

export function RightContent({ visual }: RightContentProps) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 shadow-sm">
      <Image
        src={visual.imageSrc}
        alt={visual.imageAlt}
        fill
        priority
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 50vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />

      <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/40 bg-white/10 p-3 backdrop-blur-md sm:p-4">
        <p className="text-sm font-medium text-white">
          {visual.nextMatchLabel}
        </p>
        <div className="mt-2 h-2 w-full rounded-full bg-white/40">
          <div
            className="h-full rounded-full bg-white"
            style={{ width: `${visual.progressPercent}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={visual.progressPercent}
            aria-label="Next match progress"
          />
        </div>
      </div>

      <div className="absolute -bottom-6 -right-6 hidden gap-3 md:flex">
        <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-white/70 shadow-lg">
          <Image
            src="/images/landing/basketball-court.jpg"
            alt="Basketball court"
            fill
            className="object-cover"
            sizes="96px"
          />
        </div>
        <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-white/70 shadow-lg">
          <Image
            src="/images/landing/cricket-field.jpg"
            alt="Cricket field"
            fill
            className="object-cover"
            sizes="96px"
          />
        </div>
      </div>
    </div>
  );
}

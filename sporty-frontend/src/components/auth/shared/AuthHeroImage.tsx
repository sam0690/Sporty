"use client";

import Image from "next/image";

type AuthHeroImageProps = {
  title: string;
  subtitle?: string;
  bullets?: string[];
};

export function AuthHeroImage({ title, subtitle, bullets = [] }: AuthHeroImageProps) {
  return (
    <div className="relative hidden min-h-[460px] overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-primary-100/60 via-white to-surface-100 shadow-2xl md:block">
      <div className="absolute inset-0 opacity-70">
        <Image
          src="/images/landing/hero-stadium.svg"
          alt="Sports stadium"
          fill
          className="object-cover"
          sizes="(min-width: 768px) 45vw, 0vw"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-end gap-2 p-7 text-white">
        <h3 className="text-2xl font-bold leading-tight">{title}</h3>
        {subtitle ? <p className="text-sm text-white/90">{subtitle}</p> : null}
        {bullets.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-white/90">
            {bullets.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

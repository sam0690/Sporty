"use client";

import { Check } from "lucide-react";
import { BoltGlyph, SPORT_GLYPHS } from "@/components/landing/sport-icons";

type AuthHeroImageProps = {
  title: string;
  subtitle?: string;
  bullets?: string[];
};

// Pure-CSS branded panel beside the auth form — a dark "broadcast" ink slab
// (Design_System.md §6) that anchors the bright form column with high contrast.
export function AuthHeroImage({
  title,
  subtitle,
  bullets = [],
}: AuthHeroImageProps) {
  return (
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-xl bg-ink-block text-on-ink shadow-lg">
      {/* accent bar + ambient wash */}
      <div className="h-1.5 gradient-action" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 50% at 20% 15%, rgba(220,38,38,0.16), transparent 55%), radial-gradient(60% 50% at 100% 100%, rgba(147,51,234,0.14), transparent 55%)",
        }}
      />

      <div className="relative flex h-full flex-col justify-between p-8">
        {/* brand */}
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-sm bg-primary text-on-primary shadow-hard-sm">
            <BoltGlyph className="size-5" />
          </span>
          <span className="font-condensed text-2xl font-bold uppercase leading-none tracking-[0.06em] text-on-ink">
            SPOR<span className="text-primary">TY</span>
          </span>
        </div>

        {/* headline */}
        <div className="max-w-sm">
          <h3 className="font-condensed text-5xl font-bold uppercase leading-[0.92] tracking-[0.01em] text-on-ink">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-3 text-sm leading-6 text-on-ink-muted">{subtitle}</p>
          )}

          {bullets.length > 0 && (
            <ul className="mt-6 space-y-2.5">
              {bullets.map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-primary/20 text-primary">
                    <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span className="font-condensed text-sm font-semibold uppercase tracking-[0.04em] text-on-ink">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* sport chips */}
        <div className="flex flex-wrap items-center gap-2.5">
          {SPORT_GLYPHS.map(({ Icon, label, color }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5"
            >
              <span style={{ color }}>
                <Icon className="size-4" />
              </span>
              <span className="font-condensed text-xs font-semibold uppercase tracking-[0.1em] text-on-ink">
                {label}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

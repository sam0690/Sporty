"use client";

import { BoltGlyph, SPORT_GLYPHS } from "@/components/landing/sport-icons";

type AuthHeroImageProps = {
  title: string;
  subtitle?: string;
  bullets?: string[];
};

// Pure-CSS branded panel that sits beside the auth form. Replaces the old
// stock-photo hero with a dark "broadcast" surface consistent with the live
// match page — same gradient, glow and volt accent language.
export function AuthHeroImage({
  title,
  subtitle,
  bullets = [],
}: AuthHeroImageProps) {
  return (
    <div className="relative h-full min-h-[520px] overflow-hidden card-surface">
      {/* accent bar + ambient glow */}
      <div
        className="h-1"
        style={{
          background: "linear-gradient(90deg, #e2c368, #b39a55)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 50% at 20% 15%, rgba(226,195,104,0.14), transparent 55%), radial-gradient(60% 50% at 100% 100%, rgba(0,212,255,0.12), transparent 55%)",
        }}
      />
      <div className="auth-dot-pattern pointer-events-none absolute inset-0 opacity-[0.12]" />

      <div className="relative flex h-full flex-col justify-between p-8">
        {/* brand */}
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-9 place-items-center rounded-[3px] text-surface-0"
            style={{
              background: "linear-gradient(150deg, #f0d382, #e2c368)",
              boxShadow: "0 0 24px rgba(226,195,104,0.4)",
            }}
          >
            <BoltGlyph className="size-5" />
          </span>
          <span className="font-bebas text-2xl leading-none tracking-[3px] text-fg-1">
            SPORTY
          </span>
        </div>

        {/* headline */}
        <div className="max-w-sm">
          <h3 className="font-bebas text-5xl leading-[0.95] tracking-[2px] text-fg-1">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-3 text-sm leading-6 text-fg-2">{subtitle}</p>
          )}

          {bullets.length > 0 && (
            <ul className="mt-6 space-y-2.5">
              {bullets.map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success/14 text-success">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
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
              className="inline-flex items-center gap-2 rounded-[3px] border border-white/10 bg-white/3 px-3 py-1.5"
            >
              <span style={{ color }}>
                <Icon className="size-4" />
              </span>
              <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-fg-1">
                {label}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

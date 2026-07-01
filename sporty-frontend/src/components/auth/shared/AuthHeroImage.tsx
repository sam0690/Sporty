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
    <div className="relative h-full min-h-[520px] overflow-hidden rounded-[16px] border border-[rgba(255,255,255,0.1)] bg-gradient-to-b from-[#14141b] to-[#0b0b10] shadow-[0_30px_70px_-30px_rgba(0,0,0,1)]">
      {/* accent bar + ambient glow */}
      <div
        className="h-1"
        style={{
          background: "linear-gradient(90deg, #e8fb25, #00ff88 55%, #00d4ff)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 50% at 20% 15%, rgba(232,251,37,0.14), transparent 55%), radial-gradient(60% 50% at 100% 100%, rgba(0,212,255,0.12), transparent 55%)",
        }}
      />
      <div className="auth-dot-pattern pointer-events-none absolute inset-0 opacity-[0.12]" />

      <div className="relative flex h-full flex-col justify-between p-8">
        {/* brand */}
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-9 place-items-center rounded-[8px] text-[#0a0a0f]"
            style={{
              background: "linear-gradient(150deg, #f0ff45, #e8fb25)",
              boxShadow: "0 0 24px rgba(232,251,37,0.4)",
            }}
          >
            <BoltGlyph className="size-5" />
          </span>
          <span className="font-bebas text-2xl leading-none tracking-[3px] text-[#f0f0f0]">
            SPORTY
          </span>
        </div>

        {/* headline */}
        <div className="max-w-sm">
          <h3 className="font-bebas text-5xl leading-[0.95] tracking-[2px] text-[#f0f0f0]">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-3 text-sm leading-6 text-[#9a9aa5]">{subtitle}</p>
          )}

          {bullets.length > 0 && (
            <ul className="mt-6 space-y-2.5">
              {bullets.map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[rgba(0,255,136,0.14)] text-[#00ff88]">
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
                  <span className="font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-[#d7d7de]">
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
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5"
            >
              <span style={{ color }}>
                <Icon className="size-4" />
              </span>
              <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#d7d7de]">
                {label}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

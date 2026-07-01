import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/classUtils";
import { SPORT_GLYPHS } from "@/components/landing/sport-icons";
import type { LandingHeroContent } from "@/components/landing/landing-hero/types";

type LeftContentProps = {
  content: LandingHeroContent;
};

export function LeftContent({ content }: LeftContentProps) {
  const titleLines = content.title.split("\n");

  return (
    <div className="max-w-2xl">
      <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.08)] px-3 py-1.5 font-barlow-condensed text-[11px] font-700 uppercase tracking-[2px] text-[#e8fb25]">
        <span className="size-1.5 rounded-full bg-[#e8fb25] animate-live-pulse" />
        {content.badge}
      </span>

      <h1
        id="landing-hero-title"
        className="mt-6 font-bebas text-6xl leading-[0.92] tracking-[3px] text-[#f0f0f0] md:text-8xl"
      >
        {titleLines.map((line, idx) => (
          <span
            key={line}
            className={cn("block", idx === titleLines.length - 1 && "text-transparent [-webkit-background-clip:text] [background-clip:text]")}
            style={
              idx === titleLines.length - 1
                ? { backgroundImage: "linear-gradient(100deg, #e8fb25, #00ff88)" }
                : undefined
            }
          >
            {line}
          </span>
        ))}
      </h1>

      <p className="mt-5 max-w-xl text-base leading-7 text-[#9a9aa5] md:text-lg">
        {content.description}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {content.ctas.map((cta) => {
          const isPrimary = cta.variant === "primary";

          return (
            <Link key={cta.label} href={cta.href} className="hover:no-underline">
              <Button
                variant={isPrimary ? "primary" : "outline"}
                size="lg"
                className={cn(
                  "h-12 min-w-40 px-6 text-sm font-700",
                  isPrimary &&
                    "shadow-[0_10px_30px_-10px_rgba(232,251,37,0.5)]",
                  !isPrimary &&
                    "!border-white/20 !text-[#f0f0f0] hover:!bg-[#1d1d26] hover:!text-[#f0f0f0]",
                )}
              >
                {!isPrimary ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="mr-2 h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M10 9l5 3-5 3z" />
                  </svg>
                ) : null}
                {cta.label}
              </Button>
            </Link>
          );
        })}
      </div>

      {/* Sport chips */}
      <div className="mt-7 flex flex-wrap items-center gap-2.5">
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

      <div className="mt-8 flex items-center gap-4 text-sm text-[#9a9aa5]">
        <div className="flex -space-x-2" aria-hidden="true">
          {content.stat.avatars.map((avatar) => (
            <span
              key={avatar}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0a0a0f] bg-[rgba(232,251,37,0.16)] font-barlow-condensed text-[10px] font-700 text-[#e8fb25]"
            >
              {avatar}
            </span>
          ))}
        </div>
        <span>{content.stat.text}</span>
      </div>
    </div>
  );
}

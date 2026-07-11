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
      <span className="inline-flex items-center gap-2 rounded-[3px] border border-accent/30 bg-accent/8 px-3 py-1.5 font-sans text-[11px] font-700 uppercase tracking-[2px] text-accent">
        <span className="size-1.5 rounded-full bg-accent animate-live-pulse" />
        {content.badge}
      </span>

      <h1
        id="landing-hero-title"
        className="mt-6 font-display text-6xl leading-[0.92] tracking-[-0.02em] text-fg-1 md:text-8xl"
      >
        {titleLines.map((line, idx) => (
          <span
            key={line}
            className={cn(
              "block",
              idx === titleLines.length - 1 && "text-accent",
            )}
          >
            {line}
          </span>
        ))}
      </h1>

      <p className="mt-5 max-w-xl text-base leading-7 text-fg-2 md:text-lg">
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
                  !isPrimary &&
                    "border-white/20! text-fg-1! hover:bg-surface-3! hover:text-fg-1!",
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
            className="inline-flex items-center gap-2 rounded-[3px] border border-white/10 bg-surface-1 px-3 py-1.5"
          >
            <span style={{ color }}>
              <Icon className="size-4" />
            </span>
            <span className="font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-1">
              {label}
            </span>
          </span>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-4 text-sm text-fg-2">
        <div className="flex -space-x-2" aria-hidden="true">
          {content.stat.avatars.map((avatar) => (
            <span
              key={avatar}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border-2 border-surface-0 bg-accent/16 font-sans text-[10px] font-700 text-accent"
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

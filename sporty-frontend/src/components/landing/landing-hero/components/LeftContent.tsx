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
      <span
        className="float-up inline-flex items-center gap-2 rounded-[3px] border border-accent/30 bg-accent/8 px-3 py-1.5 font-sans text-[11px] font-700 uppercase tracking-[2px] text-accent"
        style={{ animationDelay: "0.05s" }}
      >
        <span className="size-1.5 rounded-full bg-accent animate-live-pulse" />
        {content.badge}
      </span>

      <h1
        id="landing-hero-title"
        className="mt-6 font-display text-5xl leading-[0.92] tracking-[-0.02em] text-fg-1 sm:text-6xl md:text-7xl"
        style={{ textWrap: "balance" }}
      >
        {titleLines.map((line, idx) => (
          <span
            key={line}
            className={cn(
              "float-up block",
              idx === titleLines.length - 1 && "text-accent",
            )}
            style={{ animationDelay: `${0.12 + idx * 0.08}s` }}
          >
            {line}
          </span>
        ))}
      </h1>

      <p
        className="float-up mt-5 max-w-xl text-base leading-7 text-fg-2 md:text-lg"
        style={{ animationDelay: "0.3s" }}
      >
        {content.description}
      </p>

      <div
        className="float-up mt-8 flex flex-wrap items-center gap-3"
        style={{ animationDelay: "0.4s" }}
      >
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
                {cta.label}
              </Button>
            </Link>
          );
        })}
      </div>

      {/* Sport chips — the roster of playable sports, in their identity colors */}
      <div
        className="float-up mt-7 flex flex-wrap items-center gap-2.5"
        style={{ animationDelay: "0.5s" }}
      >
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
    </div>
  );
}

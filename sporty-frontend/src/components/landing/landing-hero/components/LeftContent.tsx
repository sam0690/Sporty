import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/classUtils";
import type { LandingHeroContent } from "@/components/landing/landing-hero/types";

type LeftContentProps = {
  content: LandingHeroContent;
};

export function LeftContent({ content }: LeftContentProps) {
  const titleLines = content.title.split("\n");

  return (
    <div className="max-w-2xl">
      <span className="inline-flex items-center rounded-[3px] border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] px-3 py-1 text-[11px] font-600 tracking-[0.08em] text-[#e8fb25]">
        {content.badge}
      </span>

      <h1
        id="landing-hero-title"
        className="mt-6 font-bebas text-6xl tracking-[4px] text-[#f0f0f0] md:text-8xl"
      >
        {titleLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h1>

      <p className="mt-5 max-w-xl text-base leading-7 text-[#555560] md:text-lg">
        {content.description}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {content.ctas.map((cta) => {
          const isPrimary = cta.variant === "primary";

          return (
            <Link
              key={cta.label}
              href={cta.href}
              className="hover:no-underline"
            >
              <Button
                variant={isPrimary ? "primary" : "outline"}
                size="lg"
                className={cn(
                  "h-11 min-w-36 rounded-[3px] px-6 text-sm font-600",
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

      <p className="mt-5 text-sm text-[#555560]">
        Football | Basketball | Cricket - All in one place
      </p>

      <div className="mt-8 flex items-center gap-4 text-sm text-[#555560]">
        <div className="flex -space-x-2" aria-hidden="true">
          {content.stat.avatars.map((avatar) => (
            <span
              key={avatar}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border-2 border-background bg-[rgba(232,251,37,0.2)] text-[10px] font-600 text-[#f0f0f0]"
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

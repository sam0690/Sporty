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
      <span className="inline-flex items-center gap-2 rounded-full bg-surface-200 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-primary">
        <span
          className="inline-block h-2 w-2 rounded-full border border-primary"
          aria-hidden="true"
        />
        {content.badge}
      </span>

      <h1
        id="landing-hero-title"
        className="mt-5 text-5xl font-bold tracking-tight text-primary md:text-6xl lg:text-7xl lg:leading-[1.05]"
      >
        {titleLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h1>

      <p className="mt-7 max-w-xl text-lg leading-8 text-surface-600">
        {content.description}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {content.ctas.map((cta) => {
          const isPrimary = cta.variant === "primary";

          return (
            <Link key={cta.label} href={cta.href}>
              <Button
                variant={isPrimary ? "primary" : "outline"}
                size="lg"
                className={cn(
                  "h-12 min-w-39 rounded-xl px-7 text-base font-semibold",
                  isPrimary
                    ? "shadow-card hover:bg-primary-800"
                    : "bg-surface text-primary hover:bg-surface-100",
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

      <div className="mt-8 flex items-center gap-4 text-sm text-surface-500">
        <div className="flex -space-x-2" aria-hidden="true">
          {content.stat.avatars.map((avatar) => (
            <span
              key={avatar}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-surface-200 text-[10px] font-semibold text-primary"
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

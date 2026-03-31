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
      <span className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-[11px] font-medium tracking-[0.08em] text-gray-500">
        {content.badge}
      </span>

      <h1
        id="landing-hero-title"
        className="mt-6 text-4xl font-light tracking-tight text-gray-900 md:text-5xl"
      >
        {titleLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h1>

      <p className="mt-5 max-w-xl text-base leading-7 text-gray-500 md:text-lg">
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
                  "h-11 min-w-36 rounded-full px-6 text-sm font-semibold shadow-sm",
                  isPrimary
                    ? "!bg-[#247BA0] !text-white hover:!bg-[#1d6280]"
                    : "border border-gray-300 !bg-white !text-gray-700 hover:!bg-gray-50",
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

      <p className="mt-5 text-sm text-gray-500">Football | Basketball | Cricket - All in one place</p>

      <div className="mt-8 flex items-center gap-4 text-sm text-gray-500">
        <div className="flex -space-x-2" aria-hidden="true">
          {content.stat.avatars.map((avatar) => (
            <span
              key={avatar}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-semibold text-gray-700"
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

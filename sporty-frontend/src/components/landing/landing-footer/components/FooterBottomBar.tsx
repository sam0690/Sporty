import Link from "next/link";
import type { FooterBottomContent } from "@/components/landing/landing-footer/types";

type FooterBottomBarProps = {
  content: FooterBottomContent;
};

export function FooterBottomBar({ content }: FooterBottomBarProps) {
  return (
    <div className="border-t border-surface-200 bg-surface-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-primary text-[10px] text-primary-foreground"
            aria-hidden="true"
          >
            ⚑
          </span>
          {content.brandLabel}
        </div>

        <nav
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-surface-600"
          aria-label="Footer links"
        >
          {content.links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="text-xs text-surface-500">{content.copyright}</p>
      </div>
    </div>
  );
}

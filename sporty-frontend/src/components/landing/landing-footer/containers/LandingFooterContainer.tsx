import Link from "next/link";
import { BoltGlyph } from "@/components/landing/sport-icons";

const LINK_GROUPS: { title: string; links: { label: string; href: string }[] }[] =
  [
    {
      title: "Features",
      links: [
        { label: "Multi-sport leagues", href: "/#features" },
        { label: "Lineup tools", href: "/#how-it-works" },
        { label: "Live leaderboard", href: "/dashboard" },
      ],
    },
    {
      title: "Support",
      links: [
        { label: "Help Center", href: "/support" },
        { label: "Terms", href: "/terms" },
        { label: "Privacy", href: "/privacy" },
      ],
    },
    {
      title: "Social",
      links: [
        { label: "Twitter", href: "https://twitter.com" },
        { label: "Instagram", href: "https://instagram.com" },
        { label: "YouTube", href: "https://youtube.com" },
      ],
    },
  ];

export function LandingFooterContainer() {
  return (
    <footer
      className="relative bg-ink-block text-on-ink"
      aria-labelledby="landing-footer-title"
      id="pricing"
    >
      {/* top edge accent */}
      <div className="h-1 w-full gradient-action" aria-hidden />

      <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8 lg:pb-14 lg:pt-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-sm bg-primary text-on-primary">
                <BoltGlyph className="size-4" />
              </span>
              <span
                id="landing-footer-title"
                className="font-condensed text-2xl font-bold uppercase leading-none tracking-[0.06em] text-on-ink"
              >
                SPOR<span className="text-primary">TY</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-on-ink-muted">
              Run fantasy teams across football, basketball, and cricket — one
              squad, every matchday.
            </p>
          </div>

          {LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="font-condensed text-[11px] font-semibold uppercase tracking-[0.18em] text-on-ink-muted">
                {group.title}
              </h4>
              <ul className="mt-4 space-y-2.5 text-sm text-on-ink-muted">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-primary hover:no-underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-sm text-on-ink-muted sm:flex-row">
          <p>© 2026 Sporty. All rights reserved.</p>
          <p className="font-condensed text-xs font-semibold uppercase tracking-[0.16em]">
            Football · Basketball · Cricket
          </p>
        </div>
      </div>
    </footer>
  );
}

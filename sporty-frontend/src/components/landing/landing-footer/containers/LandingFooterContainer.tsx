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
        // { label: "Help Center", href: "/support" }, // disabled — not needed for users right now
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
      className="relative border-t border-white/8 bg-surface-0"
      aria-labelledby="landing-footer-title"
    >
      <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8 lg:pb-14 lg:pt-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-[3px] bg-accent text-surface-0">
                <BoltGlyph className="size-4" />
              </span>
              <span
                id="landing-footer-title"
                className="font-display text-2xl leading-none tracking-[-0.02em] text-fg-1"
              >
                SPORTY
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-fg-2">
              Run fantasy teams across football, basketball, and cricket — one
              squad, every matchday.
            </p>
          </div>

          {LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="section-label">{group.title}</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-fg-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-accent hover:no-underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/6 pt-6 text-sm text-fg-3 sm:flex-row">
          <p>© 2026 Sporty. All rights reserved.</p>
          <p className="font-sans text-xs font-700 uppercase tracking-[2px]">
            Football · Basketball · Cricket
          </p>
        </div>
      </div>
    </footer>
  );
}

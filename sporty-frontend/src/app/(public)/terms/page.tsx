import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Sporty",
  description: "The terms that govern your use of Sporty.",
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "1. What Sporty is",
    body: [
      "Sporty is a free fantasy sports platform. You create or join leagues, build squads across football, basketball, and cricket, and earn points from real match performance. Sporty is a game of skill played for fun — it involves no wagering, no entry fees, and no cash prizes.",
    ],
  },
  {
    heading: "2. Your account",
    body: [
      "You sign in with an email address or a Google account. You are responsible for activity that happens under your account. Keep your credentials to yourself and let us know via the in-app support center if you believe your account has been compromised.",
      "You must be at least 13 years old (or the minimum age of digital consent in your country) to use Sporty.",
    ],
  },
  {
    heading: "3. Fair play",
    body: [
      "Don't abuse the service: no automated scraping, no attempting to disrupt scoring or drafts, no harassing other members in league chat, and no impersonating other people. League commissioners may remove members who break their league's rules; we may suspend accounts that break these terms.",
    ],
  },
  {
    heading: "4. Your content",
    body: [
      "League names, team names, chat messages, and similar content you create stay yours. By posting them you give us permission to display them to the other members of your leagues, which is what the product is for. Don't post content that is unlawful or that you don't have the right to share.",
    ],
  },
  {
    heading: "5. Sports data",
    body: [
      "Match results, player statistics, and live scores are provided for entertainment. Some data is simulated and some comes from third-party providers; we don't guarantee accuracy or availability, and scoring corrections may be applied after a gameweek closes.",
    ],
  },
  {
    heading: "6. The service is provided as-is",
    body: [
      "Sporty is provided without warranties of any kind. To the maximum extent permitted by law, we are not liable for indirect or consequential damages arising from your use of the service, including lost league standings, missed lineups, or scoring discrepancies.",
    ],
  },
  {
    heading: "7. Changes",
    body: [
      "We may update the service and these terms. If the terms change materially, we'll surface that in the product. Continuing to use Sporty after a change means you accept the updated terms.",
    ],
  },
  {
    heading: "8. Contact",
    body: [
      "Questions about these terms? Open a ticket from the in-app support center and we'll get back to you.",
    ],
  },
];

export default function TermsPage() {
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6 sm:py-16">
      <p className="section-label">Legal</p>
      <h1 className="mt-2 font-display text-4xl leading-none tracking-[-0.02em] text-fg-1">
        Terms of Service
      </h1>
      <p className="mt-3 text-sm text-fg-3">Last updated: July 17, 2026</p>

      <div className="mt-10 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
              {section.heading}
            </h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-2.5 text-sm leading-6 text-fg-2">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}

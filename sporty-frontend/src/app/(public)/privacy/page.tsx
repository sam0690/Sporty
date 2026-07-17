import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Sporty",
  description: "What Sporty collects, why, and what we never do with it.",
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "1. What we collect",
    body: [
      "Account details: your name, email address, and avatar — either entered at sign-up or shared by Google when you sign in with Google.",
      "Game data: the leagues you join, squads you build, lineups, transfers, chat messages, and support tickets. This is the product working as intended — your leaguemates see your team name, lineup, and scores because that's what a fantasy league is.",
      "Technical basics: standard server logs (IP address, browser type, timestamps) used for security and debugging.",
    ],
  },
  {
    heading: "2. What we use it for",
    body: [
      "Running the game: authentication, scoring, standings, notifications about your leagues, and support.",
      "We do not sell your personal data, we do not run third-party advertising, and we do not use your data to train AI models.",
    ],
  },
  {
    heading: "3. Cookies",
    body: [
      "Sporty uses a small number of first-party cookies to keep you signed in securely (httpOnly session tokens and a CSRF protection token). There are no tracking or advertising cookies.",
    ],
  },
  {
    heading: "4. Third parties",
    body: [
      "Sign-in with Google is handled by Google under their own privacy policy. Our infrastructure providers (hosting, database, email delivery) process data on our behalf solely to run the service.",
      "Sports statistics shown in the product are licensed or simulated data about public sporting events, not personal data about you.",
    ],
  },
  {
    heading: "5. Retention & deletion",
    body: [
      "Your data is kept while your account is active. If you want your account and its personal data deleted, open a ticket from the in-app support center and we'll take care of it. League records may keep an anonymized placeholder so historical standings still add up.",
    ],
  },
  {
    heading: "6. Changes",
    body: [
      "If this policy changes materially, we'll surface that in the product. The date below always reflects the latest revision.",
    ],
  },
  {
    heading: "7. Contact",
    body: [
      "Privacy questions or requests? Open a ticket from the in-app support center.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-14 sm:px-6 sm:py-16">
      <p className="section-label">Legal</p>
      <h1 className="mt-2 font-display text-4xl leading-none tracking-[-0.02em] text-fg-1">
        Privacy Policy
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

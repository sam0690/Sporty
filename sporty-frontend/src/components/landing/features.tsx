import Link from "next/link";
import { Button } from "@/components/ui/Button";

// The features section sells the product by rendering the product: static
// vignettes in the exact broadcast language of the dashboard, leaderboard,
// and draft room. All display data is illustrative.

const TABLE_ROWS = [
  { rank: 1, team: "Volt Athletic", manager: "Amara O.", pts: 412, delta: "up" },
  { rank: 2, team: "Northside XI", manager: "You", pts: 405, delta: "up", you: true },
  { rank: 3, team: "Bench Warmers", manager: "Dev P.", pts: 398, delta: "down" },
  { rank: 4, team: "Casual Sundays", manager: "Lena K.", pts: 371, delta: "flat" },
] as const;

const SQUAD_ROWS = [
  { pos: "FWD", sport: "football", name: "B. Saka", pts: 12 },
  { pos: "PG", sport: "basketball", name: "S. Gilgeous-Alexander", pts: 31 },
  { pos: "BAT", sport: "cricket", name: "V. Kohli", pts: 24 },
  { pos: "MID", sport: "football", name: "M. Ødegaard", pts: 8 },
] as const;

const DRAFT_PICKS = [
  { pick: "3.06", team: "Bench Warmers", name: "N. Jokić" },
  { pick: "3.05", team: "Volt Athletic", name: "E. Haaland" },
] as const;

const FEATURE_LIST = [
  {
    title: "Head-to-head matchups",
    body: "Face one rival each gameweek. Win, lose, or draw — the table remembers.",
  },
  {
    title: "Waivers, free agents & trades",
    body: "Full roster management for draft leagues: waiver claims, trade offers, commissioner veto.",
  },
  {
    title: "Auto-pick optimizer",
    body: "One tap builds the strongest legal squad your budget allows — then you overrule it.",
  },
  {
    title: "Budget or draft leagues",
    body: "Salary-cap squads or a live snake draft with your friends. Same scoring, different chaos.",
  },
] as const;

function DeltaMark({ delta }: { delta: "up" | "down" | "flat" }) {
  if (delta === "up") return <span className="text-success">▲</span>;
  if (delta === "down") return <span className="text-danger">▼</span>;
  return <span className="text-fg-3">—</span>;
}

function LeaderboardVignette() {
  return (
    <div className="card-surface overflow-hidden lg:col-span-7" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-3">
        <span className="live-badge">Live</span>
        <span className="section-label">Gameweek 6 · League Table</span>
      </div>
      <ul>
        {TABLE_ROWS.map((row) => (
          <li
            key={row.rank}
            className={`flex items-center gap-4 border-b border-white/4 px-5 py-3.5 last:border-b-0 ${
              "you" in row && row.you ? "bg-accent/6" : ""
            }`}
          >
            <span
              className={`w-6 text-center font-display text-lg leading-none num ${
                row.rank === 1 ? "rank-1" : "text-fg-2"
              }`}
            >
              {row.rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-sans text-sm font-700 text-fg-1">
                {row.team}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-3">
                {row.manager}
                {"you" in row && row.you ? (
                  <span className="rounded-[2px] bg-accent/15 px-1.5 py-px font-sans text-[9px] font-700 uppercase tracking-[1.5px] text-accent">
                    You
                  </span>
                ) : null}
              </span>
            </span>
            <span className="text-xs">
              <DeltaMark delta={row.delta} />
            </span>
            <span className="w-14 text-right font-display text-xl leading-none num text-accent">
              {row.pts}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SquadVignette() {
  return (
    <div className="card-surface overflow-hidden lg:col-span-5" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-3">
        <span className="section-label">Your Squad</span>
        <span className="section-label">3 Sports · 1 Team</span>
      </div>
      <ul>
        {SQUAD_ROWS.map((row) => (
          <li
            key={row.name}
            className="flex items-center gap-3 border-b border-white/4 px-5 py-3.5 last:border-b-0"
          >
            <span
              className={`sport-badge-${row.sport} w-11 rounded-[2px] py-1 text-center font-sans text-[10px] font-700 uppercase tracking-[1px]`}
            >
              {row.pos}
            </span>
            <span className="min-w-0 flex-1 truncate font-sans text-sm font-700 text-fg-1">
              {row.name}
            </span>
            <span className="font-display text-lg leading-none num text-fg-1">
              {row.pts}
              <span className="ml-1 text-[10px] font-sans font-700 uppercase text-fg-3">
                pts
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-white/6 px-5 py-3 text-xs leading-5 text-fg-3">
        Mixed leagues score every sport with its own rules — one squad, one
        total, one table.
      </p>
    </div>
  );
}

function DraftVignette() {
  return (
    <div className="card-surface overflow-hidden lg:col-span-5" aria-hidden="true">
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-3">
        <span className="live-badge">On the clock</span>
        <span className="section-label">Live Draft · Round 3</span>
      </div>
      <div className="px-5 py-6 text-center">
        <p className="font-display text-6xl leading-none tracking-[-0.02em] num text-fg-1">
          00:42
        </p>
        <p className="mt-3 font-sans text-xs font-700 uppercase tracking-[1.5px] text-accent">
          Pick 3.07 — Northside XI is up
        </p>
      </div>
      <ul className="border-t border-white/6">
        {DRAFT_PICKS.map((p) => (
          <li
            key={p.pick}
            className="flex items-center gap-3 border-b border-white/4 px-5 py-2.5 text-xs last:border-b-0"
          >
            <span className="w-9 font-display text-sm leading-none num text-fg-3">
              {p.pick}
            </span>
            <span className="flex-1 truncate text-fg-3">{p.team}</span>
            <span className="font-sans font-700 text-fg-1">{p.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeatureIndex() {
  return (
    <div className="lg:col-span-7">
      <ul className="divide-y divide-white/8 border-y border-white/8">
        {FEATURE_LIST.map((f) => (
          <li key={f.title} className="grid gap-1.5 py-5 sm:grid-cols-[240px_1fr] sm:gap-8">
            <h3 className="font-display text-lg leading-6 tracking-[-0.02em] text-fg-1">
              {f.title}
            </h3>
            <p className="max-w-prose text-sm leading-6 text-fg-2">{f.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingFeatures() {
  return (
    <section
      className="relative bg-background"
      aria-labelledby="landing-features-title"
      id="features"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-22">
        <div className="max-w-3xl">
          <h2
            id="landing-features-title"
            className="font-display text-4xl tracking-[-0.02em] text-fg-1 md:text-6xl"
            style={{ textWrap: "balance" }}
          >
            Run your league like a broadcast.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-fg-2 md:text-lg">
            Live tables, live drafts, live points — the same screens your
            league argues over all weekend, from kickoff to final whistle.
          </p>
        </div>

        <div className="mt-12 grid items-start gap-6 lg:mt-14 lg:grid-cols-12">
          <LeaderboardVignette />
          <SquadVignette />
          <DraftVignette />
          <FeatureIndex />
        </div>
      </div>
    </section>
  );
}

export function CtaBand() {
  return (
    <section className="bg-accent" aria-labelledby="landing-cta-title">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8 lg:py-16">
        <div>
          <h2
            id="landing-cta-title"
            className="font-display text-4xl tracking-[-0.02em] text-surface-0 md:text-5xl"
            style={{ textWrap: "balance" }}
          >
            Your league starts tonight.
          </h2>
          <p className="mt-2 text-base font-500 text-surface-0/75">
            Free to play. Draft in minutes, live by kickoff.
          </p>
        </div>
        <Link href="/register" className="shrink-0 hover:no-underline">
          <Button
            size="lg"
            className="h-12 min-w-48 bg-surface-0! px-8 text-accent! hover:bg-surface-1!"
          >
            Create Your League
          </Button>
        </Link>
      </div>
    </section>
  );
}

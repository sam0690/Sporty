import { Trophy } from "lucide-react";
import type { LandingHeroVisual } from "@/components/landing/landing-hero/types";
import { FootballGlyph, CricketGlyph } from "@/components/landing/sport-icons";

type RightContentProps = {
  visual: LandingHeroVisual;
};

// A pure-CSS "broadcast" fixture card that mirrors the live match page — it
// sells the product far better than a stock stadium photo and keeps the landing
// visually consistent with /matches/[id].
const HOME = { name: "Arsenal", initials: "ARS", color: "#DC2626", score: 2 };
const AWAY = { name: "Chelsea", initials: "CHE", color: "#2563EB", score: 1 };

const TIMELINE = [
  { minute: "67'", label: "Goal", who: "Saka", color: "#16A34A" },
  { minute: "54'", label: "Yellow Card", who: "Caicedo", color: "#CA8A04" },
  { minute: "39'", label: "Goal", who: "Ødegaard", color: "#16A34A" },
];

export function RightContent({ visual }: RightContentProps) {
  return (
    <div className="relative">
      {/* floating premium accent */}
      <div className="absolute -right-3 -top-4 z-10 hidden rounded-lg bg-primary px-4 py-3 text-on-primary shadow-lg sm:block">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5" strokeWidth={2} />
          <div>
            <div className="font-condensed text-[10px] uppercase tracking-[0.12em] text-on-primary/80">
              Top League
            </div>
            <div className="font-condensed text-sm font-bold leading-none">
              $10K Prize
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
        {/* team-colour accent bar */}
        <div
          className="h-1.5"
          style={{
            background: `linear-gradient(90deg, ${HOME.color}, ${HOME.color} 42%, ${AWAY.color} 58%, ${AWAY.color})`,
          }}
        />

        {/* status row */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="pill-live">Live</span>
          <span className="section-label">Premier League</span>
        </div>

        {/* scoreboard */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-7">
          <div className="flex items-center justify-end gap-3 text-right">
            <div className="min-w-0">
              <p className="truncate font-condensed text-sm font-bold uppercase tracking-[0.02em] text-ink">
                {HOME.name}
              </p>
              <p className="section-label mt-1">Home</p>
            </div>
            <Crest team={HOME} />
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center font-condensed text-5xl font-bold leading-none tracking-[0.01em]">
              <span style={{ color: HOME.color }} className="tabular-nums">
                {HOME.score}
              </span>
              <span className="px-2 text-ink-faint">:</span>
              <span style={{ color: AWAY.color }} className="tabular-nums">
                {AWAY.score}
              </span>
            </div>
            <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 font-condensed text-[10px] font-semibold uppercase tracking-[0.12em] tabular-nums text-primary">
              67:14
            </p>
          </div>

          <div className="flex items-center justify-start gap-3">
            <Crest team={AWAY} />
            <div className="min-w-0">
              <p className="truncate font-condensed text-sm font-bold uppercase tracking-[0.02em] text-ink">
                {AWAY.name}
              </p>
              <p className="section-label mt-1">Away</p>
            </div>
          </div>
        </div>

        {/* mini event timeline */}
        <div className="border-t border-border bg-surface-muted px-5 py-4">
          <p className="section-label">Match Events</p>
          <ul className="mt-3 space-y-2.5">
            {TIMELINE.map((e) => (
              <li key={e.minute} className="flex items-center gap-3">
                <span className="w-8 text-right font-condensed text-base font-bold leading-none tabular-nums text-ink-muted">
                  {e.minute}
                </span>
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-sm"
                  style={{
                    color: e.color,
                    background: `${e.color}1a`,
                  }}
                >
                  <FootballGlyph className="size-3.5" />
                </span>
                <span className="font-condensed text-xs font-bold uppercase tracking-[0.02em] text-ink">
                  {e.label}
                </span>
                <span className="text-xs text-ink-muted">· {e.who}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* next matchday progress */}
        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
              <CricketGlyph className="size-4 text-cricket" />
              {visual.nextMatchLabel}
            </span>
            <span className="font-condensed text-sm font-bold tracking-[0.04em] text-primary">
              {visual.progressPercent}%
            </span>
          </div>
          <div
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={visual.progressPercent}
            aria-label="Next match progress"
          >
            <div
              className="h-full rounded-full gradient-action transition-all duration-500"
              style={{ width: `${visual.progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Crest({
  team,
}: {
  team: { initials: string; color: string; name: string };
}) {
  return (
    <span
      className="grid size-12 shrink-0 place-items-center rounded-sm font-condensed text-lg font-bold leading-none tracking-[0.02em]"
      style={{
        color: team.color,
        background: `${team.color}14`,
        border: `1.5px solid ${team.color}40`,
      }}
      aria-label={team.name}
    >
      {team.initials}
    </span>
  );
}

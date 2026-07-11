type FixturesHeroProps = {
  totalFixtures: number;
  totalLive: number;
  totalCompetitions: number;
};

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-left">
      <p className="num font-bebas text-3xl leading-none tracking-[1px] text-fg-1 sm:text-4xl">
        {value}
      </p>
      <p className="section-label mt-1.5">{label}</p>
    </div>
  );
}

export function FixturesHero({
  totalFixtures,
  totalLive,
  totalCompetitions,
}: FixturesHeroProps) {
  return (
    <header className="relative overflow-hidden card-surface px-5 py-9 sm:px-10 sm:py-12">
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-xl">
          <p className="section-label">Matchday</p>
          <h1 className="mt-3 font-bebas text-5xl leading-[0.95] tracking-[2px] text-fg-1 sm:text-7xl">
            Fixtures &amp; Results
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-fg-2">
            Live scores, upcoming kickoffs and recent results across football,
            basketball and cricket — free to browse, no account needed.
          </p>
        </div>

        {totalLive > 0 && (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-[3px] border border-danger/32 bg-danger/10 px-3.5 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-danger">
            <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
            {totalLive} playing now
          </span>
        )}
      </div>

      <div className="relative mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-white/7 pt-6">
        <Stat value={totalFixtures} label="Fixtures" />
        <span className="hidden h-9 w-px bg-white/8 sm:block" />
        <Stat value={totalLive} label="Live now" />
        <span className="hidden h-9 w-px bg-white/8 sm:block" />
        <Stat value={totalCompetitions} label="Competitions" />
      </div>
    </header>
  );
}

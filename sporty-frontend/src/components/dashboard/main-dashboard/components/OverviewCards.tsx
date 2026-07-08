import type { OverviewStat } from "@/components/dashboard/main-dashboard/types";

type OverviewCardsProps = {
  stats: OverviewStat[];
  isLoading?: boolean;
};

const ACCENTS = ["#e8fb25", "#00ff88", "#ff6b00", "#00d4ff"];

function isPositiveChange(change: string): boolean {
  return change.trim().startsWith("+") || /^up\b/i.test(change.trim());
}

export function OverviewCards({
  stats,
  isLoading = false,
}: OverviewCardsProps) {
  return (
    <section aria-label="Overview Stats" className="mb-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((stat, index) => {
          const accent = ACCENTS[index % ACCENTS.length];
          const positive = isPositiveChange(stat.change);

          return (
            <div
              key={stat.label}
              className="pop-in overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-gradient-to-b from-[#14141b] to-[#0f0f14] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset,0_18px_40px_-26px_rgba(0,0,0,0.9)]"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div
                aria-hidden
                className="h-[2px] w-full"
                style={{
                  background: `linear-gradient(90deg, ${accent}, transparent 80%)`,
                }}
              />
              <div className="p-4 sm:p-5">
                <p className="section-label">{stat.label}</p>
                {isLoading ? (
                  <div className="skeleton mt-2.5 h-9 w-20 rounded-[6px]" />
                ) : (
                  <p
                    className="num mt-1 font-bebas text-4xl leading-none tracking-[1px] sm:text-5xl"
                    style={{ color: accent }}
                  >
                    {stat.value}
                  </p>
                )}
                <p
                  className={`mt-2 font-barlow-condensed text-xs font-600 uppercase tracking-[1px] ${
                    positive ? "text-[#00ff88]" : "text-[#777783]"
                  }`}
                >
                  {isLoading ? " " : stat.change}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

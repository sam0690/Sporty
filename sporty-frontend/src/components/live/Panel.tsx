// Shared card shell for the live match cards. Gives every panel the same
// surface, border, header rhythm and title treatment so the match page reads as
// one designed system instead of a stack of ad-hoc boxes. An optional leading
// icon + accent tints the header rule and glyph.

type PanelProps = {
  title: string;
  icon?: React.ReactNode;
  accent?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
};

export function Panel({
  title,
  icon,
  accent = "#e8fb25",
  action,
  children,
  className = "",
  bodyClassName = "p-5",
}: PanelProps) {
  return (
    <section
      className={`pop-in overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-gradient-to-b from-[#14141b] to-[#0f0f14] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_20px_44px_-26px_rgba(0,0,0,0.95)] transition-colors duration-300 hover:border-[rgba(255,255,255,0.13)] ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.07)] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span
              className="grid size-7 shrink-0 place-items-center rounded-[7px]"
              style={{
                color: accent,
                background: `${accent}17`,
                boxShadow: `0 0 0 1px ${accent}26`,
              }}
            >
              {icon}
            </span>
          )}
          <span className="section-label !text-[rgba(255,255,255,0.62)]">
            {title}
          </span>
        </div>
        {action}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

// Empty-state block used inside panels when there is no data yet.
export function PanelEmpty({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] text-[#555560]">
        {icon}
      </span>
      <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#9a9aa5]">
        {title}
      </p>
      {hint && <p className="max-w-[24ch] text-xs text-[#555560]">{hint}</p>}
    </div>
  );
}

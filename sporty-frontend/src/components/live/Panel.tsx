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
  accent = "#DC2626",
  action,
  children,
  className = "",
  bodyClassName = "p-5",
}: PanelProps) {
  return (
    <section
      className={`overflow-hidden rounded-[10px] border border-[rgba(11,18,32,0.08)] bg-gradient-to-b from-[#FFFFFF] to-[#FFFFFF] shadow-[0_1px_0_rgba(11,18,32,0.03)_inset,0_18px_40px_-24px_rgba(0,0,0,0.9)] ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[rgba(11,18,32,0.07)] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span
              className="grid size-6 shrink-0 place-items-center rounded-[6px]"
              style={{ color: accent, background: `${accent}1a` }}
            >
              {icon}
            </span>
          )}
          <span className="section-label !text-[rgba(11,18,32,0.62)]">
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
      <span className="grid size-11 place-items-center rounded-full border border-[rgba(11,18,32,0.08)] bg-[rgba(11,18,32,0.02)] text-[#6B7280]">
        {icon}
      </span>
      <p className="font-barlow-condensed text-sm font-bold uppercase tracking-[1px] text-[#6B7280]">
        {title}
      </p>
      {hint && <p className="max-w-[24ch] text-xs text-[#6B7280]">{hint}</p>}
    </div>
  );
}

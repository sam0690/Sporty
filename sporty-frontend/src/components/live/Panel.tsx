// Shared card shell for the live match cards. Gives every panel the same
// surface, border, header rhythm and title treatment so the match page reads as
// one designed system instead of a stack of ad-hoc boxes. An optional leading
// icon + accent tints the header glyph.

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
  accent = "#e2c368",
  action,
  children,
  className = "",
  bodyClassName = "p-5",
}: PanelProps) {
  return (
    <section
      className={`pop-in overflow-hidden card-surface transition-colors duration-150 hover:border-white/13 ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-3">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span
              className="grid size-7 shrink-0 place-items-center rounded-[3px] border"
              style={{
                color: accent,
                background: `${accent}14`,
                borderColor: `${accent}33`,
              }}
            >
              {icon}
            </span>
          )}
          <span className="section-label">{title}</span>
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
      <span className="grid size-11 place-items-center rounded-[3px] border border-white/8 text-fg-3">
        {icon}
      </span>
      <p className="font-sans text-sm font-700 uppercase tracking-[1px] text-fg-2">
        {title}
      </p>
      {hint && <p className="max-w-[24ch] text-xs text-fg-3">{hint}</p>}
    </div>
  );
}

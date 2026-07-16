import { SPORT_GLYPHS } from "@/components/landing/sport-icons";

type SportFilterChipsProps = {
  active: string;
  onChange: (sport: string) => void;
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex items-center gap-1.5 rounded-[3px] bg-accent px-3 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-surface-0 transition-colors hover:bg-accent-bright"
          : "inline-flex items-center gap-1.5 rounded-[3px] border border-white/12 bg-transparent px-3 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2 transition-colors hover:border-white/28 hover:text-fg-1"
      }
    >
      {children}
    </button>
  );
}

export function SportFilterChips({ active, onChange }: SportFilterChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Chip active={active === "all"} onClick={() => onChange("all")}>
        All Sports
      </Chip>
      {SPORT_GLYPHS.map(({ Icon, label, color }) => {
        const key = label.toLowerCase();
        const isActive = active === key;
        return (
          <Chip key={key} active={isActive} onClick={() => onChange(key)}>
            <span style={{ color: isActive ? undefined : color }}>
              <Icon className="size-4" />
            </span>
            {label}
          </Chip>
        );
      })}
    </div>
  );
}

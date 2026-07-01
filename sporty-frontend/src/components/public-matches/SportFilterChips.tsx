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
          ? "inline-flex items-center gap-2 rounded-full bg-[#e8fb25] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#0a0a0f] shadow-[0_8px_20px_-6px_rgba(232,251,37,0.55)] transition-transform hover:scale-[1.03]"
          : "inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.02)] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5] transition-colors hover:border-[rgba(255,255,255,0.28)] hover:text-[#f0f0f0]"
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

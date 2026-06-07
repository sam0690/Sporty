import type { ReactNode } from "react";
import { CourtRenderer } from "@/components/dashboard/shared/formation/CourtRenderer";
import { PitchRenderer } from "@/components/dashboard/shared/formation/PitchRenderer";
import type {
  FormationPlayerLike,
  FormationSection,
  FormationSlot,
  TeamLayout,
} from "@/components/dashboard/shared/formation/formationEngine";

type FormationRendererProps<TPlayer extends FormationPlayerLike> = {
  layout: TeamLayout<TPlayer>;
  className?: string;
  showSectionLabels?: boolean;
  renderSlot: (args: {
    section: FormationSection<TPlayer>;
    slot: FormationSlot<TPlayer>;
  }) => ReactNode;
};

function SectionSurface<TPlayer extends FormationPlayerLike>({
  section,
  children,
}: {
  section: FormationSection<TPlayer>;
  children: ReactNode;
}) {
  if (section.surface === "court") {
    return <CourtRenderer>{children}</CourtRenderer>;
  }

  return <PitchRenderer>{children}</PitchRenderer>;
}

export function FormationRenderer<TPlayer extends FormationPlayerLike>({
  layout,
  className = "",
  showSectionLabels = true,
  renderSlot,
}: FormationRendererProps<TPlayer>) {
  return (
    <div className={`space-y-4 ${className}`}>
      {layout.sections.map((section) => (
        <section key={section.id} className="space-y-2">
          {showSectionLabels ? (
            <div className="flex items-center justify-between gap-2 px-1 text-xs text-white/70">
              <div className="flex items-center gap-2">
                <span className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-2 py-1 font-600 text-[#f0f0f0]">
                  {section.title}
                </span>
                {section.formationLabel ? (
                  <span className="rounded-[3px] border border-accent-primary/25 bg-[rgba(232,251,37,0.1)] px-2 py-1 font-600 text-[#e8fb25]">
                    {section.formationLabel}
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                {section.surface}
              </span>
            </div>
          ) : null}

          <SectionSurface section={section}>
            {section.slots.map((slot) => (
              <div
                key={slot.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${slot.x * 100}%`,
                  top: `${slot.y * 100}%`,
                  zIndex: Math.round(slot.y * 100),
                }}
              >
                {renderSlot({ section, slot })}
              </div>
            ))}
          </SectionSurface>
        </section>
      ))}
    </div>
  );
}

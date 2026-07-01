import type {
  HowItWorksIcon,
  HowItWorksStep,
} from "@/components/landing/how-it-works/types";
import { Check, Trophy, UserPlus, Users } from "lucide-react";

type HowItWorksCardProps = {
  step: HowItWorksStep;
  index: number;
};

function StepIcon({ icon }: { icon: HowItWorksIcon }) {
  if (icon === "sport") {
    return <UserPlus className="h-5 w-5" aria-hidden="true" />;
  }

  if (icon === "squad") {
    return <Users className="h-5 w-5" aria-hidden="true" />;
  }

  return <Trophy className="h-5 w-5" aria-hidden="true" />;
}

export function HowItWorksCard({ step, index }: HowItWorksCardProps) {
  return (
    <article className="block accent-bar accent-primary group relative overflow-hidden p-7">
      {/* watermark step number */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-2 -top-4 font-condensed text-8xl font-bold leading-none tracking-[0.02em] text-surface-muted"
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="relative flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-sm bg-primary-soft text-primary">
          <StepIcon icon={step.icon} />
        </span>
        <span className="font-condensed text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Step {index + 1}
        </span>
      </div>

      <h3 className="relative mt-5 font-condensed text-3xl font-bold uppercase tracking-[0.01em] text-ink">
        {step.title}
      </h3>
      <p className="relative mt-2.5 text-sm leading-6 text-ink-muted">
        {step.description}
      </p>

      <ul className="relative mt-5 space-y-2 text-sm text-ink-soft">
        {step.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2.5">
            <Check
              className="mt-0.5 size-4 shrink-0 text-primary"
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

import type {
  HowItWorksIcon,
  HowItWorksStep,
} from "@/components/landing/how-it-works/types";
import { Trophy, UserPlus, Users } from "lucide-react";

type HowItWorksCardProps = {
  step: HowItWorksStep;
};

function StepIcon({ icon }: { icon: HowItWorksIcon }) {
  if (icon === "sport") {
    return <UserPlus className="h-6 w-6" aria-hidden="true" />;
  }

  if (icon === "squad") {
    return <Users className="h-6 w-6" aria-hidden="true" />;
  }

  return <Trophy className="h-6 w-6" aria-hidden="true" />;
}

export function HowItWorksCard({ step }: HowItWorksCardProps) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center shadow-card backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-accent-primary/30 hover:bg-white/8 hover:shadow-hover">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary">
        <StepIcon icon={step.icon} />
      </div>

      <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-foreground">
        {step.title}
      </h3>
      <p className="mt-3 text-base leading-7 text-foreground/65">
        {step.description}
      </p>

      <ul className="mt-5 space-y-2 text-sm text-foreground/55">
        {step.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start justify-center gap-2.5">
            <span
              className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-accent-primary"
              aria-hidden="true"
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

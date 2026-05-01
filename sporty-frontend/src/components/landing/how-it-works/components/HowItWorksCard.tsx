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
    <article className="rounded-lg bg-white p-6 text-center shadow-card hover:shadow-hover transition-all duration-200 border border-accent/20">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <StepIcon icon={step.icon} />
      </div>

      <h3 className="mt-5 font-display text-2xl font-bold tracking-tight text-black">
        {step.title}
      </h3>
      <p className="mt-3 text-base leading-7 text-secondary">
        {step.description}
      </p>

      <ul className="mt-5 space-y-2 text-sm text-secondary">
        {step.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start justify-center gap-2.5">
            <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

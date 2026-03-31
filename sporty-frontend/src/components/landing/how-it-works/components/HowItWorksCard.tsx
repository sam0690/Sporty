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
    <article className="text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-primary-600">
        <StepIcon icon={step.icon} />
      </div>

      <h3 className="mt-5 text-2xl font-light tracking-tight text-gray-900">
        {step.title}
      </h3>
      <p className="mt-3 text-base leading-7 text-gray-500">
        {step.description}
      </p>

      <ul className="mt-5 space-y-2 text-sm text-gray-500">
        {step.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start justify-center gap-2.5">
            <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gray-400" aria-hidden="true" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

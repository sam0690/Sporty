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
    <article className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-6 text-center shadow-card  transition-all duration-200 hover:-translate-y-1 hover:border-[rgba(232,251,37,0.3)] hover:bg-[#1d1d26] hover:shadow-hover">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-[3px] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]">
        <StepIcon icon={step.icon} />
      </div>

      <h3 className="mt-5 font-bebas text-4xl tracking-[2px] text-[#f0f0f0]">
        {step.title}
      </h3>
      <p className="mt-3 text-base leading-7 text-[#f0f0f0]/65">
        {step.description}
      </p>

      <ul className="mt-5 space-y-2 text-sm text-[#555560]">
        {step.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start justify-center gap-2.5">
            <span
              className="mt-1 inline-block h-1.5 w-1.5 rounded-[3px] bg-accent-primary"
              aria-hidden="true"
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

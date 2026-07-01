import type {
  HowItWorksIcon,
  HowItWorksStep,
} from "@/components/landing/how-it-works/types";
import { Trophy, UserPlus, Users } from "lucide-react";

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
    <article className="group relative overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-gradient-to-b from-[#16161d] to-[#0f0f14] p-7 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)] transition-all duration-200 hover:-translate-y-1 hover:border-[rgba(232,251,37,0.35)]">
      {/* watermark step number */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-2 -top-4 font-bebas text-8xl leading-none tracking-[2px] text-[rgba(255,255,255,0.04)]"
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="relative flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[10px] bg-[rgba(232,251,37,0.1)] text-[#e8fb25] ring-1 ring-[rgba(232,251,37,0.25)]">
          <StepIcon icon={step.icon} />
        </span>
        <span className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#555560]">
          Step {index + 1}
        </span>
      </div>

      <h3 className="relative mt-5 font-bebas text-3xl tracking-[1.5px] text-[#f0f0f0]">
        {step.title}
      </h3>
      <p className="relative mt-2.5 text-sm leading-6 text-[#9a9aa5]">
        {step.description}
      </p>

      <ul className="relative mt-5 space-y-2 text-sm text-[#8a8a95]">
        {step.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2.5">
            <svg
              viewBox="0 0 24 24"
              className="mt-0.5 size-4 shrink-0 text-[#e8fb25]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

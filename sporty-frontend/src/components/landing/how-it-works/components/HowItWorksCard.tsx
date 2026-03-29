import type {
  HowItWorksIcon,
  HowItWorksStep,
} from "@/components/landing/how-it-works/types";

type HowItWorksCardProps = {
  step: HowItWorksStep;
};

function StepIcon({ icon }: { icon: HowItWorksIcon }) {
  if (icon === "sport") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 015.66 2.34M12 4a8 8 0 00-5.66 2.34" />
        <path d="M6.34 6.34L9 10m8.66-3.66L15 10m-3 2v8m-5-5l5-3 5 3" />
      </svg>
    );
  }

  if (icon === "squad") {
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="9" r="2.2" />
        <circle cx="6.8" cy="10.3" r="1.8" />
        <circle cx="17.2" cy="10.3" r="1.8" />
        <path d="M8.5 16.3c.8-1.6 2.2-2.4 3.5-2.4s2.7.8 3.5 2.4" />
        <path d="M3.9 16.8c.5-1.2 1.5-2 2.9-2.3m10.3 2.3c.5-1.2 1.5-2 2.9-2.3" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 4h8v2a4 4 0 01-8 0V4z" />
      <path d="M6 6H4a3 3 0 003 3m11-3h2a3 3 0 01-3 3" />
      <path d="M12 10v6m-3 4h6" />
    </svg>
  );
}

export function HowItWorksCard({ step }: HowItWorksCardProps) {
  return (
    <article className="rounded-2xl border border-surface-200 bg-surface px-6 py-7">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-surface-100 text-primary">
        <StepIcon icon={step.icon} />
      </div>

      <h3 className="mt-6 text-3xl font-semibold tracking-tight text-primary">
        {step.title}
      </h3>
      <p className="mt-3 text-[22px] leading-8 text-surface-600">
        {step.description}
      </p>

      <ul className="mt-6 space-y-2.5 text-base text-surface-500">
        {step.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2.5">
            <svg
              viewBox="0 0 24 24"
              className="mt-0.5 h-5 w-5 shrink-0 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

import type { HowItWorksStep } from "@/components/landing/how-it-works/types";

type HowItWorksCardProps = {
  step: HowItWorksStep;
  index: number;
};

// A step on the rail: shared hairline top edge with a gold notch, ghost
// number, then copy. Deliberately not a card — the hero and features
// sections already carry the heavy surfaces.
export function HowItWorksCard({ step, index }: HowItWorksCardProps) {
  return (
    <article className="relative border-t border-white/12 pt-7">
      <span
        aria-hidden
        className="absolute -top-px left-0 h-px w-10 bg-accent"
      />
      <span
        aria-hidden
        className="font-display text-5xl leading-none tracking-[-0.02em] text-white/12"
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <h3 className="mt-4 font-display text-2xl tracking-[-0.02em] text-fg-1">
        {step.title}
      </h3>
      <p className="mt-2.5 max-w-sm text-sm leading-6 text-fg-2">
        {step.description}
      </p>
      <p className="mt-4 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
        {step.meta.join("  ·  ")}
      </p>
    </article>
  );
}

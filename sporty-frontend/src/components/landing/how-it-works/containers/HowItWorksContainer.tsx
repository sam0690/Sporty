import { HowItWorksCard } from "@/components/landing/how-it-works/components/HowItWorksCard";
import { HowItWorksHeader } from "@/components/landing/how-it-works/components/HowItWorksHeader";
import { HOW_IT_WORKS_CONTENT } from "@/components/landing/how-it-works/constants/howItWorksData";

export function HowItWorksContainer() {
  return (
    <section
      className="relative bg-background"
      aria-labelledby="how-it-works-title"
      id="how-it-works"
    >
      <div className="relative mx-auto w-full max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-22">
        <HowItWorksHeader
          heading={HOW_IT_WORKS_CONTENT.heading}
          subheading={HOW_IT_WORKS_CONTENT.subheading}
        />

        <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3 lg:mt-16">
          {HOW_IT_WORKS_CONTENT.steps.map((step, index) => (
            <HowItWorksCard key={step.title} step={step} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

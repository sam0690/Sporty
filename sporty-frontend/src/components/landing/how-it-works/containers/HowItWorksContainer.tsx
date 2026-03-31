import { HowItWorksCard } from "@/components/landing/how-it-works/components/HowItWorksCard";
import { HowItWorksHeader } from "@/components/landing/how-it-works/components/HowItWorksHeader";
import { HOW_IT_WORKS_CONTENT } from "@/components/landing/how-it-works/constants/howItWorksData";

export function HowItWorksContainer() {
  return (
    <section className="relative bg-white" aria-labelledby="how-it-works-title" id="how-it-works">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
        <div
          className="h-full w-full bg-cover bg-center"
          style={{ backgroundImage: "url('/images/landing/football-action.jpg')" }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-22">
        <HowItWorksHeader
          heading={HOW_IT_WORKS_CONTENT.heading}
          subheading={HOW_IT_WORKS_CONTENT.subheading}
        />

        <div className="mt-12 grid gap-10 md:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {HOW_IT_WORKS_CONTENT.steps.map((step) => (
            <HowItWorksCard key={step.title} step={step} />
          ))}
        </div>
      </div>
    </section>
  );
}

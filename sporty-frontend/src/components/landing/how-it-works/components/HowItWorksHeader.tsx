type HowItWorksHeaderProps = {
  heading: string;
  subheading: string;
};

export function HowItWorksHeader({
  heading,
  subheading,
}: HowItWorksHeaderProps) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <span className="section-label">Get in the game</span>
      <h2
        id="how-it-works-title"
        className="mt-3 font-bebas text-5xl tracking-[2px] text-[#f0f0f0] md:text-6xl"
      >
        {heading}
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#9a9aa5] md:text-lg">
        {subheading}
      </p>
    </div>
  );
}

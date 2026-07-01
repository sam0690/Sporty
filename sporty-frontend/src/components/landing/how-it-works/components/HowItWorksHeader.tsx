type HowItWorksHeaderProps = {
  heading: string;
  subheading: string;
};

export function HowItWorksHeader({
  heading,
  subheading,
}: HowItWorksHeaderProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
      <span className="kicker">Get in the game</span>
      <h2
        id="how-it-works-title"
        className="mt-3 font-condensed text-5xl font-bold uppercase tracking-[0.01em] text-ink md:text-6xl"
      >
        {heading}
      </h2>
      <span className="mt-4 h-1 w-16 rounded-full bg-primary" aria-hidden="true" />
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-ink-muted md:text-lg">
        {subheading}
      </p>
    </div>
  );
}

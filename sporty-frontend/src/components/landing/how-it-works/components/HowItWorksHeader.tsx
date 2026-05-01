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
      <h2
        id="how-it-works-title"
        className="font-display text-3xl font-bold tracking-tight text-black md:text-4xl"
      >
        {heading}
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-secondary md:text-lg">
        {subheading}
      </p>
    </div>
  );
}

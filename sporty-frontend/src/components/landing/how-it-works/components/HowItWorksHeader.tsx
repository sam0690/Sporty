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
        className="text-4xl font-bold tracking-tight text-primary"
      >
        {heading}
      </h2>
      <p className="mx-auto mt-5 max-w-2xl text-xl leading-8 text-surface-600">
        {subheading}
      </p>
    </div>
  );
}

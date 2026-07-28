// The Convergence Mark — Sporty's brand icon. A single geometric "S" whose
// spine passes through a central node: the point where football, basketball
// and cricket converge into one squad. Renders in `currentColor` so callers
// tint it via text-* (gold `text-accent` by default, or a sport token).
type SportyMarkProps = {
  className?: string;
};

export function SportyMark({ className = "size-8" }: SportyMarkProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M66 30 C66 18 30 18 30 34 C30 46 66 50 66 62 C66 78 30 78 30 66"
        stroke="currentColor"
        strokeWidth={12}
        strokeLinecap="round"
      />
      <circle cx="48" cy="48" r="10" fill="currentColor" />
    </svg>
  );
}

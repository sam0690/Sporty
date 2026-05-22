import Link from "next/link";

type LogoProps = {
  onClick?: () => void;
};

export function Logo({ onClick }: LogoProps) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-foreground transition-colors hover:text-accent-primary hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
      aria-label="Sporty home"
    >
      <span className="text-base text-accent-primary" aria-hidden="true">
        ●
      </span>
      <span className="font-display text-xl font-bold tracking-[0.14em] uppercase">
        Sporty
      </span>
    </Link>
  );
}

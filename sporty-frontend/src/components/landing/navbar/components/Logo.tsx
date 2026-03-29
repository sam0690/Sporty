import Link from "next/link";

type LogoProps = {
  onClick?: () => void;
};

export function Logo({ onClick }: LogoProps) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-primary transition-colors hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label="Sporty home"
    >
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
        S
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">
        Sporty
      </span>
    </Link>
  );
}

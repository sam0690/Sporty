import Link from "next/link";

type LogoProps = {
  onClick?: () => void;
};

export function Logo({ onClick }: LogoProps) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-black transition-colors hover:text-primary hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label="Sporty home"
    >
      <span className="text-base" aria-hidden="true">
        ⚽ 🏀 🏏
      </span>
      <span className="font-display text-xl font-bold tracking-tight">
        Sporty
      </span>
    </Link>
  );
}

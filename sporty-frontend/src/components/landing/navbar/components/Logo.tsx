import Link from "next/link";

type LogoProps = {
  onClick?: () => void;
};

export function Logo({ onClick }: LogoProps) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="inline-flex items-center hover:no-underline focus-visible:outline-none"
      aria-label="Sporty home"
    >
      <span className="font-bebas text-2xl tracking-[3px] text-[#e8fb25]">
        SPORTY
      </span>
    </Link>
  );
}

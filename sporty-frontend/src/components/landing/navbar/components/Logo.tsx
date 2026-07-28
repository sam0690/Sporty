import Link from "next/link";
import { SportyMark } from "@/components/ui";

type LogoProps = {
  onClick?: () => void;
};

export function Logo({ onClick }: LogoProps) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="group inline-flex items-center gap-2.5 hover:no-underline focus-visible:outline-none"
      aria-label="Sporty home"
    >
      <SportyMark className="size-8 text-accent transition-transform duration-200 ease-out group-hover:scale-105" />
      <span className="font-display text-2xl leading-none tracking-[-0.02em] text-fg-1 transition-colors group-hover:text-accent">
        SPORTY
      </span>
    </Link>
  );
}

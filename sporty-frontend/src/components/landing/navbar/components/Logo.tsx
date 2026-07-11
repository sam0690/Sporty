import Link from "next/link";
import { BoltGlyph } from "@/components/landing/sport-icons";

type LogoProps = {
  onClick?: () => void;
};

export function Logo({ onClick }: LogoProps) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="group inline-flex items-center gap-2 hover:no-underline focus-visible:outline-none"
      aria-label="Sporty home"
    >
      <span className="grid size-8 place-items-center rounded-[3px] bg-accent text-surface-0">
        <BoltGlyph className="size-4" />
      </span>
      <span className="font-display text-2xl leading-none tracking-[-0.02em] text-fg-1 transition-colors group-hover:text-accent">
        SPORTY
      </span>
    </Link>
  );
}

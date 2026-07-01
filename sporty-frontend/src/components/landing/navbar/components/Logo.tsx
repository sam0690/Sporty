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
      <span className="grid size-8 place-items-center rounded-sm bg-primary text-on-primary shadow-hard-sm">
        <BoltGlyph className="size-4" />
      </span>
      <span className="font-condensed text-2xl font-bold uppercase leading-none tracking-[0.06em] text-ink">
        SPOR<span className="text-primary">TY</span>
      </span>
    </Link>
  );
}

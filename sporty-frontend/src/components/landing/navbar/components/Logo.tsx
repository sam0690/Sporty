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
      <span className="grid size-8 place-items-center rounded-[3px] bg-[#e8fb25] text-[#0a0a0f]">
        <BoltGlyph className="size-4" />
      </span>
      <span className="font-bebas text-2xl leading-none tracking-[3px] text-[#f0f0f0] transition-colors group-hover:text-[#e8fb25]">
        SPORTY
      </span>
    </Link>
  );
}

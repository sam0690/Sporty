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
      <span
        className="grid size-8 place-items-center rounded-[7px] text-[#0a0a0f]"
        style={{
          background: "linear-gradient(150deg, #f0ff45, #e8fb25)",
          boxShadow: "0 0 22px rgba(232,251,37,0.35)",
        }}
      >
        <BoltGlyph className="size-4" />
      </span>
      <span className="font-bebas text-2xl leading-none tracking-[3px] text-[#f0f0f0] transition-colors group-hover:text-[#e8fb25]">
        SPORTY
      </span>
    </Link>
  );
}

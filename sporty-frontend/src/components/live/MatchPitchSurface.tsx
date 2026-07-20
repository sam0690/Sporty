import type { ReactNode } from "react";

// Inline-SVG football pitch (from the provided "Pitch Only" design) — a
// full-length pitch at 66:100 that hosts both teams. Vector markings scale
// crisply and need no image asset, unlike the shared PitchRenderer PNG which
// the fantasy views still use. Coordinates are in a 660×1000 space, stretched
// to fill via preserveAspectRatio="none"; players are positioned on top in %.
const W = 660;
const H = 1000;
const LINE = "#7fd88f";
const stroke = {
  fill: "none",
  stroke: LINE,
  strokeOpacity: 0.5,
  strokeWidth: 2.5,
} as const;
const spot = { fill: LINE, fillOpacity: 0.5 } as const;

function PitchMarkings() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* Mowing stripes */}
      {Array.from({ length: 10 }).map((_, i) => (
        <rect
          key={i}
          x={0}
          y={(i * H) / 10}
          width={W}
          height={H / 10}
          fill={i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent"}
        />
      ))}
      {/* Boundary + halfway */}
      <rect x={14} y={14} width={W - 28} height={H - 28} {...stroke} />
      <line x1={14} y1={H / 2} x2={W - 14} y2={H / 2} {...stroke} />
      <circle cx={W / 2} cy={H / 2} r={80} {...stroke} />
      <circle cx={W / 2} cy={H / 2} r={3.5} {...spot} />
      {/* Top box */}
      <rect x={W / 2 - 165} y={14} width={330} height={150} {...stroke} />
      <rect x={W / 2 - 75} y={14} width={150} height={58} {...stroke} />
      <path d={`M ${W / 2 - 90} 164 A 80 80 0 0 0 ${W / 2 + 90} 164`} {...stroke} />
      <circle cx={W / 2} cy={108} r={3.5} {...spot} />
      {/* Bottom box */}
      <rect x={W / 2 - 165} y={H - 164} width={330} height={150} {...stroke} />
      <rect x={W / 2 - 75} y={H - 72} width={150} height={58} {...stroke} />
      <path
        d={`M ${W / 2 - 90} ${H - 164} A 80 80 0 0 1 ${W / 2 + 90} ${H - 164}`}
        {...stroke}
      />
      <circle cx={W / 2} cy={H - 108} r={3.5} {...spot} />
      {/* Corner arcs */}
      <path d="M 14 14 A 18 18 0 0 1 32 32" {...stroke} />
      <path d={`M ${W - 32} 14 A 18 18 0 0 0 ${W - 14} 32`} {...stroke} />
      <path d={`M 14 ${H - 32} A 18 18 0 0 0 32 ${H - 14}`} {...stroke} />
      <path d={`M ${W - 32} ${H - 14} A 18 18 0 0 0 ${W - 14} ${H - 32}`} {...stroke} />
    </svg>
  );
}

export function MatchPitchSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative mx-auto w-full overflow-hidden rounded-[20px] border ${className}`}
      style={{
        aspectRatio: "66 / 100",
        background:
          "radial-gradient(ellipse at 50% 50%, #143d24 0%, #0c2416 70%, #0a1e12 100%)",
        borderColor: "#1c2b22",
      }}
    >
      <div className="absolute inset-0">
        <PitchMarkings />
      </div>
      {children}
    </div>
  );
}

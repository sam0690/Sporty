import type { ReactNode } from "react";

// Inline-SVG basketball court (from the provided "Basketball Court Only" design)
// — a full court at 50:94 hosting both fives, vector markings so it scales
// crisply with no image asset. 500×940 space stretched to fill via
// preserveAspectRatio="none"; players are positioned on top in %.
const W = 500;
const H = 940;
const CX = W / 2;
const LINE = "#7fa8d9";
const stroke = {
  fill: "none",
  stroke: LINE,
  strokeOpacity: 0.55,
  strokeWidth: 2.5,
} as const;

function HalfCourt({ flip }: { flip: boolean }) {
  const t = (y: number) => (flip ? H - y : y);
  const sweep = flip ? 1 : 0;
  return (
    <>
      <rect x={CX - 80} y={flip ? H - 200 : 10} width={160} height={190} {...stroke} />
      <circle cx={CX} cy={t(200)} r={60} {...stroke} />
      <line x1={CX - 80} y1={t(10)} x2={CX + 80} y2={t(10)} {...stroke} strokeWidth={3} />
      <circle cx={CX} cy={t(63)} r={9} {...stroke} />
      <path d={`M ${CX - 40} ${t(63)} A 40 40 0 0 ${sweep} ${CX + 40} ${t(63)}`} {...stroke} />
      <path
        d={`M 30 ${t(10)} L 30 ${t(140)} A 233 233 0 0 ${sweep} 470 ${t(140)} L 470 ${t(10)}`}
        {...stroke}
      />
    </>
  );
}

function CourtMarkings() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      aria-hidden
    >
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
      <rect x={10} y={10} width={W - 20} height={H - 20} {...stroke} />
      <line x1={10} y1={H / 2} x2={W - 10} y2={H / 2} {...stroke} />
      <circle cx={CX} cy={H / 2} r={60} {...stroke} />
      <circle cx={CX} cy={H / 2} r={3.5} fill={LINE} fillOpacity={0.55} />
      <HalfCourt flip={false} />
      <HalfCourt flip />
    </svg>
  );
}

export function MatchCourtSurface({
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
        aspectRatio: "50 / 94",
        background:
          "radial-gradient(ellipse at 50% 50%, #16233a 0%, #0f1a2c 70%, #0a121f 100%)",
        borderColor: "#1c2532",
      }}
    >
      <div className="absolute inset-0">
        <CourtMarkings />
      </div>
      {children}
    </div>
  );
}

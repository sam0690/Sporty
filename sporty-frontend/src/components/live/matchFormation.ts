import {
  getFootballFormationBucket,
  isFootballGoalkeeper,
} from "@/lib/formation/formationEngine";
import type { LineupPlayer } from "@/types/events";

// Purpose-built layout for a real match XI — unlike the fantasy formationEngine
// (padded slots, split MID/AM rows tuned for a squad editor), this lays a clean
// set of evenly-spread rows per team on their own half of a shared pitch and
// derives an honest DEF-MID-FWD label. No center clustering, no "3-7-1" artifact.

export type MatchChip = {
  id: string;
  name: string;
  /** Role tag shown on the chip (football: GK/DEF/MID/FWD; basketball: PG/SG/…). */
  role: string;
  photoUrl?: string | null;
  isGk: boolean;
  /** 0-1 across the full pitch. */
  x: number;
  y: number;
};

export type TeamFormation = {
  label: string;
  chips: MatchChip[];
};

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// Even horizontal spread; wider rows sit in from the touchline more.
function spreadX(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0.5];
  const margin = count >= 5 ? 0.1 : count >= 4 ? 0.14 : 0.22;
  const start = margin;
  const end = 1 - margin;
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) =>
    clamp(Number((start + i * step).toFixed(4)), 0.06, 0.94),
  );
}

// A block of N midfielders reads badly as one flat row past 4 — split it into
// two lines (deeper first) the way a broadcast graphic would.
function splitMidfield(n: number): number[] {
  if (n <= 4) return n > 0 ? [n] : [];
  if (n === 5) return [2, 3];
  if (n === 6) return [3, 3];
  const front = Math.ceil(n / 2);
  return [n - front, front];
}

function sliceInto<T>(items: T[], sizes: number[]): T[][] {
  const out: T[][] = [];
  let i = 0;
  for (const size of sizes) {
    out.push(items.slice(i, i + size));
    i += size;
  }
  return out;
}

/**
 * Place one team's XI on its half of the shared pitch. Home occupies the bottom
 * half (GK at the bottom goal, y≈0.95 → forwards at the centre, y≈0.52); away is
 * mirrored into the top half and flipped horizontally so the two teams face each
 * other. A gap band is left around the halfway line so the forwards never
 * collide across it.
 */
export function buildTeamFormation(
  players: LineupPlayer[],
  side: "home" | "away",
): TeamFormation {
  const gk: LineupPlayer[] = [];
  const known: Record<"DEF" | "MID" | "FWD", LineupPlayer[]> = {
    DEF: [],
    MID: [],
    FWD: [],
  };
  const flex: LineupPlayer[] = []; // no usable position — slotted in below

  for (const p of players) {
    const pos = (p.position ?? "").trim();
    if (isFootballGoalkeeper(pos)) {
      gk.push(p);
      continue;
    }
    if (!pos) {
      flex.push(p);
      continue;
    }
    const b = getFootballFormationBucket(pos);
    if (b === "GK") gk.push(p);
    else known[b].push(p);
  }

  // Players with no usable position fill whichever outfield line is currently
  // thinnest (DEF → MID → FWD on ties), so an unmapped player still slots into
  // an available spot and the XI reads as a balanced shape rather than dropping.
  const FILL_ORDER = ["DEF", "MID", "FWD"] as const;
  for (const p of flex) {
    let best: (typeof FILL_ORDER)[number] = FILL_ORDER[0];
    for (const line of FILL_ORDER) {
      if (known[line].length < known[best].length) best = line;
    }
    known[best].push(p);
  }
  const def = known.DEF;
  const mid = known.MID;
  const fwd = known.FWD;

  // Honest three-part label from the outfield distribution.
  const label = [def.length, mid.length, fwd.length]
    .filter((n, i) => i === 0 || i === 1 || n > 0)
    .join("-");

  // Rows from goal-end → centre-line.
  const midRows = sliceInto(mid, splitMidfield(mid.length));
  const rows: { role: string; players: LineupPlayer[] }[] = [
    { role: "GK" as const, players: gk },
    { role: "DEF" as const, players: def },
    ...midRows.map((r) => ({ role: "MID" as const, players: r })),
    { role: "FWD" as const, players: fwd },
  ].filter((r) => r.players.length > 0);

  // Vertical band for this side (goal-end → just short of halfway). The centre
  // end stops well short of the line (0.545 / 0.455) so the two teams' forward
  // lines keep a clear gap across halfway instead of colliding on it.
  const goalY = side === "home" ? 0.95 : 0.05;
  const centreY = side === "home" ? 0.545 : 0.455;
  const rowCount = rows.length;

  const chips: MatchChip[] = [];
  rows.forEach((row, rowIndex) => {
    const y =
      rowCount <= 1
        ? goalY
        : goalY + (centreY - goalY) * (rowIndex / (rowCount - 1));
    const xs = spreadX(row.players.length);
    row.players.forEach((p, i) => {
      const baseX = xs[i] ?? 0.5;
      chips.push({
        id: p.player_id,
        name: p.name ?? "Unknown",
        role: row.role,
        photoUrl: p.photo_url,
        isGk: row.role === "GK",
        x: side === "home" ? baseX : Number((1 - baseX).toFixed(4)),
        y: Number(y.toFixed(4)),
      });
    });
  });

  return { label: label || "—", chips };
}

// ── Basketball ──────────────────────────────────────────────────────────────

function basketballWeight(pos: string): number {
  const p = pos.trim().toUpperCase();
  if (p.includes("PG") || p.includes("POINT")) return 0;
  if (p.includes("SG") || p.includes("SHOOT")) return 1;
  if (p.includes("SF") || p.includes("SMALL")) return 2;
  if (p.includes("PF") || p.includes("POWER")) return 3;
  if (p === "C" || p.includes("CENTER") || p.includes("CENTRE")) return 4;
  return 2; // unknown → treat as a wing
}

// Five canonical spots on a half court, guard → big. `yy` runs 0 (halfway line)
// → 1 (baseline/basket). Assigning position-sorted players to fixed spots means
// duplicate positions (two centres) never stack on one point.
const COURT_SPOTS = [
  { x: 0.5, yy: 0.14 }, // point
  { x: 0.2, yy: 0.44 }, // left wing
  { x: 0.8, yy: 0.44 }, // right wing
  { x: 0.32, yy: 0.8 }, // left low post
  { x: 0.68, yy: 0.8 }, // right low post
];

/** Lay a starting five on its half of the shared court, facing the other five. */
export function buildTeamCourt(
  players: LineupPlayer[],
  side: "home" | "away",
): TeamFormation {
  const sorted = [...players].sort(
    (a, b) =>
      basketballWeight(a.position ?? "") - basketballWeight(b.position ?? "") ||
      (a.name ?? "").localeCompare(b.name ?? ""),
  );
  const chips: MatchChip[] = sorted.map((p, i) => {
    const spot = COURT_SPOTS[i] ?? { x: 0.5, yy: 0.14 + (i - 4) * 0.12 };
    const y = side === "home" ? 0.5 + spot.yy * 0.45 : 0.5 - spot.yy * 0.45;
    const x = side === "home" ? spot.x : 1 - spot.x;
    return {
      id: p.player_id,
      name: p.name ?? "Unknown",
      role: (p.position ?? "").trim().toUpperCase() || "—",
      photoUrl: p.photo_url,
      isGk: false,
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
    };
  });
  return { label: `Starting ${players.length}`, chips };
}

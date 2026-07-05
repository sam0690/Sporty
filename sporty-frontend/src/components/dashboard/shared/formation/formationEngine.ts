import {
  getSportSectionLabel,
  getSportSurface,
  normalizeSport,
  type SportKind,
  type SurfaceKind,
} from "@/components/dashboard/shared/formation/sportRegistry";

export type FormationPlayerLike = {
  id: string;
  name: string;
  position: string;
  sport?: string | null;
  sportName?: string | null;
  sportDisplayName?: string | null;
  team?: string | null;
  realTeam?: string | null;
  points?: number | null;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isStarter?: boolean;
};

export type FormationSlot<TPlayer extends FormationPlayerLike> = {
  id: string;
  label: string;
  role: string;
  x: number;
  y: number;
  sport: SportKind;
  player: TPlayer | null;
};

export type FormationSection<TPlayer extends FormationPlayerLike> = {
  id: string;
  sport: SportKind;
  surface: SurfaceKind;
  title: string;
  formationLabel: string | null;
  slots: FormationSlot<TPlayer>[];
};

export type TeamLayout<TPlayer extends FormationPlayerLike> = {
  mode: "football" | "basketball" | "mixed";
  sections: FormationSection<TPlayer>[];
  sportSummary: Record<string, number>;
};

type RowBlueprint<TPlayer extends FormationPlayerLike> = {
  id: string;
  label: string;
  role: string;
  y: number;
  xStart: number;
  xEnd: number;
  capacity: number;
  players: TPlayer[];
};

type FootballRoleBucket =
  | "goalkeeper"
  | "defense"
  | "holdingMid"
  | "centralMid"
  | "attackingMid"
  | "attack";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distributeAcrossWidth(count: number, start: number, end: number) {
  if (count <= 1) {
    return [(start + end) / 2];
  }

  // Use a slightly narrower range if there are many players in a row to minimize edge clipping
  const margin = count > 3 ? 0.12 : 0.08;
  const effectiveStart = Math.max(start, margin);
  const effectiveEnd = Math.min(end, 1 - margin);

  const step = (effectiveEnd - effectiveStart) / (count - 1);
  return Array.from(
    { length: count },
    (_, index) => effectiveStart + index * step,
  ).map((value) => clamp(Number(value.toFixed(3)), 0.08, 0.92));
}

function normalizePosition(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export function isFootballGoalkeeper(position: string) {
  const normalized = normalizePosition(position);
  return (
    normalized === "GK" ||
    normalized === "GKP" ||
    normalized.includes("GOALKEEPER")
  );
}

function footballRoleBucket(position: string): FootballRoleBucket {
  const normalized = normalizePosition(position);

  if (isFootballGoalkeeper(normalized)) {
    return "goalkeeper";
  }

  if (
    /\b(CB|LB|RB|LWB|RWB|SW|DEF|DF|BACK|FULLBACK)\b/.test(normalized) ||
    normalized.includes("DEFENDER")
  ) {
    return "defense";
  }

  if (/\b(CDM|DM|DMC)\b/.test(normalized)) {
    return "holdingMid";
  }

  if (/\b(CAM|AM|LAM|RAM)\b/.test(normalized)) {
    return "attackingMid";
  }

  if (/\b(LM|RM|LW|RW|ML|MR)\b/.test(normalized)) {
    return "attackingMid";
  }

  if (/\b(CM|MC|MID|MF)\b/.test(normalized)) {
    return "centralMid";
  }

  if (/\b(ST|CF|FW|FWD|ATT|STRIKER)\b/.test(normalized)) {
    return "attack";
  }

  if (normalized.includes("FORWARD") || normalized.includes("ATTACK")) {
    return "attack";
  }

  return "centralMid";
}

export type FootballFormationBucket = "GK" | "DEF" | "MID" | "FWD";

function collapseToFormationBucket(
  bucket: FootballRoleBucket,
): FootballFormationBucket {
  switch (bucket) {
    case "goalkeeper":
      return "GK";
    case "defense":
      return "DEF";
    case "attack":
      return "FWD";
    default:
      // holdingMid / centralMid / attackingMid all count as MID for formation
      // purposes — the split only matters for row layout, not rule-checking.
      return "MID";
  }
}

/**
 * FPL's own starting-XI rule (confirmed via
 * premierleague.com/en/news/2174899/fpl-basics-managing-your-team): exactly
 * 1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD (outfield sums to 10). Any combination
 * inside these bounds is a valid "formation" — nothing outside them is legal.
 * This is the single source of truth for formation validity everywhere it
 * matters: live substitution-blocking, Save-time validation, and
 * Auto-Optimize's constraints.
 */
export const FOOTBALL_FORMATION_BOUNDS: Record<
  FootballFormationBucket,
  { min: number; max: number }
> = {
  GK: { min: 1, max: 1 },
  DEF: { min: 3, max: 5 },
  MID: { min: 2, max: 5 },
  FWD: { min: 1, max: 3 },
};

/** Size of a full football starting XI — fixed regardless of formation shape
 * (only the DEF/MID/FWD split varies). Used to decide how many *extra* empty
 * placeholder slots to render per line so a bench player can always be
 * dropped onto an open spot instead of being forced to swap onto an occupant. */
const FOOTBALL_STARTING_XI_SIZE = 11;

/** Football/basketball starters required from a multisport squad — mirrors
 * MULTISPORT_STARTER_REQUIREMENTS in LeagueLineup.tsx/LineupPitchView.tsx
 * (kept local here since formationEngine has no dependency on those files). */
const MULTISPORT_FOOTBALL_STARTERS = 5;
const MULTISPORT_BASKETBALL_STARTERS = 4;

/** Basketball's starting five. */
const BASKETBALL_STARTING_FIVE_SIZE = 5;

/**
 * A row's slot count used to be exactly `max(bucket.min, currentCount)` —
 * enough to render the floor, but never more. Once a bucket reached its own
 * floor (e.g. 4 defenders when the floor is 3), the row had zero spare slots,
 * so benching one player and trying to drag a *different* bench player into
 * that same line had nowhere to land except an occupied slot (forcing a
 * swap instead of a simple add). This pads one extra empty slot onto any
 * bucket that still has room to grow (below its own max) as long as the
 * overall XI isn't full yet, so an open placeholder is always available.
 */
function paddedBucketCapacity(
  count: number,
  bounds: { min: number; max: number },
  remainingRoom: number,
): number {
  if (count < bounds.min) {
    return bounds.min;
  }
  if (remainingRoom > 0 && count < bounds.max) {
    return count + 1;
  }
  return count;
}

const FORMATION_BUCKET_LABELS: Record<FootballFormationBucket, string> = {
  GK: "goalkeeper",
  DEF: "defender",
  MID: "midfielder",
  FWD: "forward",
};

export function getFootballFormationBucket(
  position: string,
): FootballFormationBucket {
  return collapseToFormationBucket(footballRoleBucket(position));
}

export function computeFootballBucketCounts<
  TPlayer extends FormationPlayerLike,
>(players: TPlayer[]): Record<FootballFormationBucket, number> {
  const counts: Record<FootballFormationBucket, number> = {
    GK: 0,
    DEF: 0,
    MID: 0,
    FWD: 0,
  };
  for (const player of players) {
    counts[collapseToFormationBucket(footballRoleBucket(player.position))] += 1;
  }
  return counts;
}

/** Validate a proposed starting XI against `FOOTBALL_FORMATION_BOUNDS`,
 * returning the first violated bound with a human-readable reason so the
 * same message can be shown live (pitch) and at Save time. */
export function validateFootballFormation<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
): { ok: true } | { ok: false; reason: string } {
  const counts = computeFootballBucketCounts(players);
  for (const bucket of ["GK", "DEF", "MID", "FWD"] as const) {
    const { min, max } = FOOTBALL_FORMATION_BOUNDS[bucket];
    const count = counts[bucket];
    const label = FORMATION_BUCKET_LABELS[bucket];
    if (count < min) {
      return {
        ok: false,
        reason:
          min === max
            ? `You need exactly ${min} ${label}${min === 1 ? "" : "s"}.`
            : `You need at least ${min} ${label}s.`,
      };
    }
    if (count > max) {
      return { ok: false, reason: `You can have at most ${max} ${label}s.` };
    }
  }
  return { ok: true };
}

function footballBucketWeight(bucket: FootballRoleBucket, position: string) {
  const normalized = normalizePosition(position);

  switch (bucket) {
    case "goalkeeper":
      return 0;
    case "defense":
      if (normalized.includes("LB") || normalized.includes("LWB")) return 0;
      if (normalized.includes("CB") || normalized.includes("SW")) return 1;
      if (normalized.includes("RB") || normalized.includes("RWB")) return 2;
      return 1;
    case "holdingMid":
      return 1;
    case "centralMid":
      if (normalized.includes("LM") || normalized.includes("LW")) return 0;
      if (normalized.includes("RM") || normalized.includes("RW")) return 2;
      return 1;
    case "attackingMid":
      if (normalized.includes("LM") || normalized.includes("LW")) return 0;
      if (normalized.includes("CAM")) return 1;
      if (normalized.includes("RM") || normalized.includes("RW")) return 2;
      return 1;
    case "attack":
      if (normalized.includes("LW")) return 0;
      if (normalized.includes("CF") || normalized.includes("ST")) return 1;
      if (normalized.includes("RW")) return 2;
      return 1;
    default:
      return 1;
  }
}

function footballPositionWeight(position: string) {
  return footballBucketWeight(footballRoleBucket(position), position);
}

function basketballPositionWeight(position: string) {
  const normalized = normalizePosition(position);

  if (normalized.includes("PG") || normalized.includes("POINT")) return 0;
  if (normalized.includes("SG") || normalized.includes("SHOOT")) return 1;
  if (normalized.includes("SF") || normalized.includes("SMALL")) return 2;
  if (normalized.includes("PF") || normalized.includes("POWER")) return 3;
  if (normalized === "C" || normalized.includes("CENTER")) return 4;
  if (normalized === "UNK" || normalized === "UNKNOWN" || normalized === "NONE")
    return -1;
  return -1; // Default to unknown for any unmapped basketball position
}

function buildBasketballFallbackRows<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
  remainingRoom: number,
) {
  const count = players.length;
  if (count === 0 && remainingRoom <= 0) return [];

  // Spread players across 3 region rows for basketball
  const topTier = players.slice(0, Math.ceil(count / 3));
  const midTier = players.slice(
    Math.ceil(count / 3),
    Math.ceil((2 * count) / 3),
  );
  const botTier = players.slice(Math.ceil((2 * count) / 3));

  // Same fix as football's per-line padding: without this, each tier's
  // capacity was exactly its current occupant count, so there was never an
  // empty slot to drop a bench player onto (only occupied ones, forcing a
  // swap) — see paddedBucketCapacity's comment for the full rationale.
  const growth = remainingRoom > 0 ? 1 : 0;

  const rows: RowBlueprint<TPlayer>[] = [];

  if (topTier.length > 0 || growth > 0) {
    rows.push({
      id: "basketball:fallback-top",
      label: "B",
      role: "fallback",
      y: 0.2,
      xStart: 0.2,
      xEnd: 0.8,
      capacity: topTier.length + growth,
      players: topTier,
    });
  }

  if (midTier.length > 0 || growth > 0) {
    rows.push({
      id: "basketball:fallback-mid",
      label: "B",
      role: "fallback",
      y: 0.45,
      xStart: 0.15,
      xEnd: 0.85,
      capacity: midTier.length + growth,
      players: midTier,
    });
  }

  if (botTier.length > 0 || growth > 0) {
    rows.push({
      id: "basketball:fallback-bot",
      label: "B",
      role: "fallback",
      y: 0.7,
      xStart: 0.25,
      xEnd: 0.75,
      capacity: botTier.length + growth,
      players: botTier,
    });
  }

  return rows;
}

function sortPlayersByWeight<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
  weightFn: (position: string) => number,
) {
  return [...players].sort(
    (left, right) =>
      weightFn(left.position) - weightFn(right.position) ||
      left.name.localeCompare(right.name),
  );
}

function buildSlots<TPlayer extends FormationPlayerLike>(
  rows: RowBlueprint<TPlayer>[],
) {
  return rows.flatMap((row) => {
    const slotCount = row.capacity;
    const xs = distributeAcrossWidth(slotCount, row.xStart, row.xEnd);
    const players = row.players.slice(0, slotCount);

    return Array.from({ length: slotCount }, (_, index) => ({
      id: `${row.id}-${index + 1}`,
      label: row.label,
      role: row.role,
      x: xs[index] ?? (row.xStart + row.xEnd) / 2,
      y: row.y,
      sport: normalizeSport(row.id.split(":")[0]),
      player: players[index] ?? null,
    }));
  });
}

function buildFootballRows<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
  targetTotal: number = FOOTBALL_STARTING_XI_SIZE,
) {
  const sortedPlayers = sortPlayersByWeight(players, footballPositionWeight);
  const remainingRoom = Math.max(0, targetTotal - sortedPlayers.length);
  const goalkeeperPlayers = sortedPlayers.filter(
    (player) => footballRoleBucket(player.position) === "goalkeeper",
  );
  const defensePlayers = sortedPlayers.filter(
    (player) => footballRoleBucket(player.position) === "defense",
  );
  const holdingMidPlayers = sortedPlayers.filter(
    (player) => footballRoleBucket(player.position) === "holdingMid",
  );
  const centralMidPlayers = sortedPlayers.filter(
    (player) => footballRoleBucket(player.position) === "centralMid",
  );
  const attackingMidPlayers = sortedPlayers.filter(
    (player) => footballRoleBucket(player.position) === "attackingMid",
  );
  const attackPlayers = sortedPlayers.filter(
    (player) => footballRoleBucket(player.position) === "attack",
  );

  const remainingPlayers = sortedPlayers.filter(
    (player) =>
      footballRoleBucket(player.position) !== "goalkeeper" &&
      footballRoleBucket(player.position) !== "defense" &&
      footballRoleBucket(player.position) !== "holdingMid" &&
      footballRoleBucket(player.position) !== "centralMid" &&
      footballRoleBucket(player.position) !== "attackingMid" &&
      footballRoleBucket(player.position) !== "attack",
  );

  const midfieldPool = [
    ...holdingMidPlayers,
    ...centralMidPlayers,
    ...attackingMidPlayers,
    ...remainingPlayers,
  ];

  const hasWideOrAdvancedMid = attackingMidPlayers.length > 0;
  const useSplitMidfield =
    midfieldPool.length >= 5 &&
    (hasWideOrAdvancedMid || attackPlayers.length <= 2);

  // Below the FPL midfield floor (2), pad the capacity so the row still
  // renders an empty slot rather than silently under-showing the shape —
  // matches how the defense/attack rows already handle a below-floor count.
  const paddedMidfieldCapacity = Math.max(
    FOOTBALL_FORMATION_BOUNDS.MID.min,
    midfieldPool.length,
  );

  const lowerMidfieldCapacity = useSplitMidfield
    ? Math.max(2, Math.min(3, holdingMidPlayers.length || 2))
    : paddedMidfieldCapacity;
  const upperMidfieldCapacity = useSplitMidfield
    ? Math.max(1, midfieldPool.length - lowerMidfieldCapacity)
    : 0;

  const lowerMidfieldPlayers = midfieldPool.slice(0, lowerMidfieldCapacity);
  const upperMidfieldPlayers = midfieldPool.slice(lowerMidfieldCapacity);

  // Row capacities actually rendered — same counts as above, plus one growth
  // slot per line while the XI still has room (see paddedBucketCapacity).
  // Kept separate from lower/upperMidfieldCapacity so the template-label
  // detection and player-slicing above stay based on real counts only.
  const midRowCapacity = paddedBucketCapacity(
    midfieldPool.length,
    FOOTBALL_FORMATION_BOUNDS.MID,
    remainingRoom,
  );
  const midGrowth = midRowCapacity - midfieldPool.length;
  const lowerMidfieldRowCapacity = useSplitMidfield
    ? lowerMidfieldCapacity
    : midRowCapacity;
  const upperMidfieldRowCapacity = useSplitMidfield
    ? upperMidfieldCapacity + midGrowth
    : 0;

  const templateLabel =
    defensePlayers.length === 4 &&
    lowerMidfieldCapacity === 2 &&
    upperMidfieldCapacity === 3 &&
    attackPlayers.length === 1
      ? "4-2-3-1"
      : defensePlayers.length === 4 &&
          midfieldPool.length === 4 &&
          attackPlayers.length === 2
        ? "4-4-2"
        : defensePlayers.length === 4 &&
            midfieldPool.length === 3 &&
            attackPlayers.length === 3
          ? "4-3-3"
          : defensePlayers.length === 3 &&
              midfieldPool.length === 5 &&
              attackPlayers.length === 2
            ? "3-5-2"
            : defensePlayers.length === 5 &&
                midfieldPool.length === 3 &&
                attackPlayers.length === 2
              ? "5-3-2"
              : `${Math.max(defensePlayers.length, 3)}-${Math.max(midfieldPool.length, 2)}-${Math.max(attackPlayers.length, 1)}`;

  const rows: RowBlueprint<TPlayer>[] = [
    {
      id: "football:goalkeeper",
      label: "GK",
      role: "goalkeeper",
      y: 0.86,
      xStart: 0.5,
      xEnd: 0.5,
      capacity: 1,
      players: goalkeeperPlayers.slice(0, 1),
    },
    {
      id: "football:defense",
      label: "DEF",
      role: "defense",
      y: 0.68,
      xStart: 0.12,
      xEnd: 0.88,
      capacity: paddedBucketCapacity(
        defensePlayers.length,
        FOOTBALL_FORMATION_BOUNDS.DEF,
        remainingRoom,
      ),
      players: defensePlayers,
    },
    {
      id: "football:midfield-lower",
      label: "MID",
      role: useSplitMidfield ? "midfield-lower" : "midfield",
      y: useSplitMidfield ? 0.46 : 0.42,
      xStart: 0.15,
      xEnd: 0.85,
      capacity: lowerMidfieldRowCapacity,
      players: useSplitMidfield ? lowerMidfieldPlayers : midfieldPool,
    },
    ...(useSplitMidfield
      ? [
          {
            id: "football:midfield-upper",
            label: "AM",
            role: "midfield-upper",
            y: 0.32,
            xStart: 0.1,
            xEnd: 0.9,
            capacity: upperMidfieldRowCapacity,
            players: upperMidfieldPlayers,
          } as RowBlueprint<TPlayer>,
        ]
      : []),
    {
      id: "football:attack",
      label: "ATT",
      role: "attack",
      y: 0.18,
      xStart: 0.24,
      xEnd: 0.76,
      capacity: paddedBucketCapacity(
        attackPlayers.length,
        FOOTBALL_FORMATION_BOUNDS.FWD,
        remainingRoom,
      ),
      players: attackPlayers,
    },
  ];

  return {
    formationLabel: templateLabel,
    rows,
  };
}

function buildBasketballRows<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
  targetTotal: number = BASKETBALL_STARTING_FIVE_SIZE,
) {
  const sortedPlayers = sortPlayersByWeight(players, basketballPositionWeight);

  const pgPlayers = sortedPlayers.filter(
    (player) => basketballPositionWeight(player.position) === 0,
  );
  const sgPlayers = sortedPlayers.filter(
    (player) => basketballPositionWeight(player.position) === 1,
  );
  const sfPlayers = sortedPlayers.filter(
    (player) => basketballPositionWeight(player.position) === 2,
  );
  const pfPlayers = sortedPlayers.filter(
    (player) => basketballPositionWeight(player.position) === 3,
  );
  const cPlayers = sortedPlayers.filter(
    (player) => basketballPositionWeight(player.position) === 4,
  );
  const unknownPlayers = sortedPlayers.filter(
    (player) => basketballPositionWeight(player.position) === -1,
  );

  // If most players are unknown, use the fallback spread layout
  if (unknownPlayers.length > sortedPlayers.length / 2) {
    const remainingRoom = Math.max(0, targetTotal - sortedPlayers.length);
    return {
      formationLabel: "Balanced Spread",
      rows: buildBasketballFallbackRows(sortedPlayers, remainingRoom),
    };
  }

  const rows: RowBlueprint<TPlayer>[] = [
    {
      id: "basketball:point-guard",
      label: "PG",
      role: "point-guard",
      y: 0.18,
      xStart: 0.5,
      xEnd: 0.5,
      capacity: 1,
      players: pgPlayers,
    },
    {
      id: "basketball:wing-guard-left",
      label: "SG",
      role: "shooting-guard",
      y: 0.3,
      xStart: 0.24,
      xEnd: 0.24,
      capacity: 1,
      players: sgPlayers,
    },
    {
      id: "basketball:wing-forward-right",
      label: "SF",
      role: "small-forward",
      y: 0.3,
      xStart: 0.76,
      xEnd: 0.76,
      capacity: 1,
      players: sfPlayers,
    },
    {
      id: "basketball:power-forward",
      label: "PF",
      role: "power-forward",
      y: 0.54,
      xStart: 0.34,
      xEnd: 0.34,
      capacity: 1,
      players: pfPlayers,
    },
    {
      id: "basketball:center",
      label: "C",
      role: "center",
      y: 0.54,
      xStart: 0.66,
      xEnd: 0.66,
      capacity: 1,
      players: cPlayers,
    },
  ];

  return {
    formationLabel: "Half court",
    rows,
  };
}

export function generateCoordinates<TPlayer extends FormationPlayerLike>(
  rows: RowBlueprint<TPlayer>[],
) {
  return buildSlots(rows) as FormationSlot<TPlayer>[];
}

function buildFootballFormation<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
) {
  const { formationLabel, rows } = buildFootballRows(players);
  return {
    formationLabel,
    slots: generateCoordinates(rows),
  };
}

function buildBasketballLayout<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
) {
  const { formationLabel, rows } = buildBasketballRows(players);
  return {
    formationLabel,
    slots: generateCoordinates(rows),
  };
}

function buildMixedLayout<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
): FormationSlot<TPlayer>[] {
  const grouped = assignByAvailableSports(players);
  const footballPlayers = (grouped["football"] ?? []) as TPlayer[];
  const basketballPlayers = (grouped["basketball"] ?? []) as TPlayer[];

  // If there are other sports in mixed mode, we merge them into the closest category
  // for visual representation, or just list them.
  const others = Object.entries(grouped)
    .filter(([s]) => s !== "football" && s !== "basketball" && s !== "unknown")
    .flatMap(([, p]) => p) as TPlayer[];

  const bbPool = [...basketballPlayers, ...others];

  // Football at the TOP (scaled to top 50% of surface) — matches the pitch
  // half of multisport-court.png.
  const fbRows = buildFootballRows(footballPlayers, MULTISPORT_FOOTBALL_STARTERS)
    .rows;
  const footballSlots = generateCoordinates(
    fbRows.map((row) => ({
      ...row,
      y: Number((row.y * 0.5 + 0.08).toFixed(3)),
    })),
  );

  // Basketball (and others) at the BOTTOM (scaled to bottom 45% of surface) —
  // matches the court half of multisport-court.png.
  const bbRows = buildBasketballRows(bbPool, MULTISPORT_BASKETBALL_STARTERS).rows;
  const basketballSlots = generateCoordinates(
    bbRows.map((row) => ({
      ...row,
      y: Number((row.y * 0.45 + 0.52).toFixed(3)),
    })),
  );

  return [...footballSlots, ...basketballSlots];
}

function assignByAvailableSports<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
) {
  return players.reduce<Record<string, TPlayer[]>>((acc, player) => {
    const sport = normalizeSport(player.sport ?? player.sportName);
    const key = sport === "unknown" ? "unknown" : sport;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(player);
    return acc;
  }, {});
}

function sectionForSport<TPlayer extends FormationPlayerLike>(
  sport: SportKind,
  players: TPlayer[],
): FormationSection<TPlayer> {
  if (sport === "basketball") {
    const basketball = buildBasketballLayout(players);
    return {
      id: "basketball-section",
      sport,
      surface: getSportSurface(sport),
      title: getSportSectionLabel(sport),
      formationLabel: basketball.formationLabel,
      slots: basketball.slots,
    };
  }

  if (sport === "football") {
    const football = buildFootballFormation(players);
    return {
      id: "football-section",
      sport,
      surface: getSportSurface(sport),
      title: getSportSectionLabel(sport),
      formationLabel: football.formationLabel,
      slots: football.slots,
    };
  }

  const fallbackSlots = generateCoordinates<TPlayer>([
    {
      id: `${sport}:fallback`,
      label: getSportSectionLabel(sport),
      role: "fallback",
      y: 0.5,
      xStart: 0.5,
      xEnd: 0.5,
      capacity: Math.max(1, players.length),
      players,
    },
  ]);

  return {
    id: `${sport}-section`,
    sport,
    surface: getSportSurface(sport),
    title: getSportSectionLabel(sport),
    formationLabel: null,
    slots: fallbackSlots,
  };
}

export function groupPlayersBySport<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
) {
  return assignByAvailableSports(players);
}

export function buildTeamLayout<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
  options: { activeOnly?: boolean } = {},
): TeamLayout<TPlayer> {
  const activePlayers = options.activeOnly
    ? players.filter((player) => player.isStarter !== false)
    : [...players];

  const grouped = groupPlayersBySport(activePlayers);

  // Which sport(s) this pitch represents is a property of the whole squad, not
  // just the currently-selected starters — a fresh basketball team with zero
  // starters picked yet must still render the basketball court, not fall back
  // to football. Slot *content* still only shows active players (`grouped`
  // above); this second grouping only decides the surface/mode.
  const groupedForMode = options.activeOnly ? groupPlayersBySport(players) : grouped;
  const sportKeys = Object.keys(groupedForMode)
    .filter((key) => key !== "unknown")
    .sort((left, right) => {
      const priority = ["football", "basketball", "cricket", "unknown"];
      return priority.indexOf(left) - priority.indexOf(right);
    }) as SportKind[];

  const visibleSports = sportKeys.filter(
    (sport) => (groupedForMode[sport] ?? []).length > 0,
  );

  let sections: FormationSection<TPlayer>[] = [];
  const mode =
    visibleSports.length > 1
      ? "mixed"
      : visibleSports[0] === "basketball"
        ? "basketball"
        : "football";

  if (mode === "mixed") {
    // Single Unified Pitch for Multisport
    const footballCount = (grouped["football"] ?? []).length;
    const basketballCount = (grouped["basketball"] ?? []).length;

    sections = [
      {
        id: "mixed-section",
        sport: "football", // Unified indicator
        surface: "multisport",
        title: "Multisport Pitch",
        formationLabel: `${footballCount} FB + ${basketballCount} BB`,
        slots: buildMixedLayout(activePlayers),
      },
    ];
  } else {
    sections =
      visibleSports.length <= 1
        ? [
            sectionForSport(
              visibleSports[0] ??
                normalizeSport(
                  activePlayers[0]?.sport ?? activePlayers[0]?.sportName,
                ),
              grouped[visibleSports[0] ?? "unknown"] ?? activePlayers,
            ),
          ]
        : visibleSports.map((sport) =>
            sectionForSport(sport, grouped[sport] ?? []),
          );
  }

  const sportSummary = Object.entries(grouped).reduce<Record<string, number>>(
    (acc, [sport, sportPlayers]) => {
      acc[sport] = sportPlayers.length;
      return acc;
    },
    {},
  );

  return {
    mode,
    sections,
    sportSummary,
  };
}

export { buildFootballFormation, buildBasketballLayout };

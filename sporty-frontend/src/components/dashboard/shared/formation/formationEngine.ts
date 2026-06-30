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
) {
  const count = players.length;
  if (count === 0) return [];

  // Spread players across 3 region rows for basketball
  const topTier = players.slice(0, Math.ceil(count / 3));
  const midTier = players.slice(
    Math.ceil(count / 3),
    Math.ceil((2 * count) / 3),
  );
  const botTier = players.slice(Math.ceil((2 * count) / 3));

  const rows: RowBlueprint<TPlayer>[] = [];

  if (topTier.length > 0) {
    rows.push({
      id: "basketball:fallback-top",
      label: "B",
      role: "fallback",
      y: 0.2,
      xStart: 0.2,
      xEnd: 0.8,
      capacity: topTier.length,
      players: topTier,
    });
  }

  if (midTier.length > 0) {
    rows.push({
      id: "basketball:fallback-mid",
      label: "B",
      role: "fallback",
      y: 0.45,
      xStart: 0.15,
      xEnd: 0.85,
      capacity: midTier.length,
      players: midTier,
    });
  }

  if (botTier.length > 0) {
    rows.push({
      id: "basketball:fallback-bot",
      label: "B",
      role: "fallback",
      y: 0.7,
      xStart: 0.25,
      xEnd: 0.75,
      capacity: botTier.length,
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
) {
  const sortedPlayers = sortPlayersByWeight(players, footballPositionWeight);
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

  const lowerMidfieldCapacity = useSplitMidfield
    ? Math.max(2, Math.min(3, holdingMidPlayers.length || 2))
    : midfieldPool.length;
  const upperMidfieldCapacity = useSplitMidfield
    ? Math.max(1, midfieldPool.length - lowerMidfieldCapacity)
    : 0;

  const lowerMidfieldPlayers = midfieldPool.slice(0, lowerMidfieldCapacity);
  const upperMidfieldPlayers = midfieldPool.slice(lowerMidfieldCapacity);

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
      capacity: Math.max(3, defensePlayers.length || 4),
      players: defensePlayers,
    },
    {
      id: "football:midfield-lower",
      label: "MID",
      role: useSplitMidfield ? "midfield-lower" : "midfield",
      y: useSplitMidfield ? 0.46 : 0.42,
      xStart: 0.15,
      xEnd: 0.85,
      capacity: useSplitMidfield ? lowerMidfieldCapacity : midfieldPool.length,
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
            capacity: upperMidfieldCapacity,
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
      capacity: Math.max(1, attackPlayers.length || 2),
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
    return {
      formationLabel: "Balanced Spread",
      rows: buildBasketballFallbackRows(sortedPlayers),
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

/**
 * Selectable football shapes for the manual formation picker. These are purely
 * cosmetic: pitch coordinates don't affect scoring, and slot roles aren't
 * enforced, so a preset just redistributes the eleven starters across rows.
 */
export const FOOTBALL_FORMATIONS = [
  { label: "4-4-2", def: 4, mid: 4, att: 2 },
  { label: "4-3-3", def: 4, mid: 3, att: 3 },
  { label: "3-5-2", def: 3, mid: 5, att: 2 },
  { label: "5-3-2", def: 5, mid: 3, att: 2 },
  { label: "4-5-1", def: 4, mid: 5, att: 1 },
  { label: "3-4-3", def: 3, mid: 4, att: 3 },
] as const;

export type FootballFormation = (typeof FOOTBALL_FORMATIONS)[number]["label"];

function footballRowsFromFormation<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
  formation: string,
) {
  const preset = FOOTBALL_FORMATIONS.find((entry) => entry.label === formation);
  if (!preset) {
    return null;
  }

  const sorted = sortPlayersByWeight(players, footballPositionWeight);
  const goalkeeperPlayers = sorted.filter(
    (player) => footballRoleBucket(player.position) === "goalkeeper",
  );
  const outfieldPlayers = sorted.filter(
    (player) => footballRoleBucket(player.position) !== "goalkeeper",
  );

  const defenseEnd = preset.def;
  const midfieldEnd = preset.def + preset.mid;
  const attackEnd = midfieldEnd + preset.att;

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
      capacity: preset.def,
      players: outfieldPlayers.slice(0, defenseEnd),
    },
    {
      id: "football:midfield-lower",
      label: "MID",
      role: "midfield",
      y: 0.42,
      xStart: 0.15,
      xEnd: 0.85,
      capacity: preset.mid,
      players: outfieldPlayers.slice(defenseEnd, midfieldEnd),
    },
    {
      id: "football:attack",
      label: "ATT",
      role: "attack",
      y: 0.18,
      xStart: 0.24,
      xEnd: 0.76,
      capacity: preset.att,
      players: outfieldPlayers.slice(midfieldEnd, attackEnd),
    },
  ];

  return { formationLabel: preset.label, rows };
}

function buildFootballFormation<TPlayer extends FormationPlayerLike>(
  players: TPlayer[],
  formation?: string,
) {
  const preset = formation
    ? footballRowsFromFormation(players, formation)
    : null;
  const { formationLabel, rows } = preset ?? buildFootballRows(players);
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

  // Basketball (and others) at the TOP (scaled to top 40% of pitch)
  const bbRows = buildBasketballRows(bbPool).rows;
  const basketballSlots = generateCoordinates(
    bbRows.map((row) => ({
      ...row,
      y: Number((row.y * 0.5 + 0.08).toFixed(3)),
    })),
  );

  // Football at the BOTTOM (scaled to bottom 50% of pitch)
  const fbRows = buildFootballRows(footballPlayers).rows;
  const footballSlots = generateCoordinates(
    fbRows.map((row) => ({
      ...row,
      y: Number((row.y * 0.45 + 0.52).toFixed(3)),
    })),
  );

  return [...basketballSlots, ...footballSlots];
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
  formation?: string,
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
    const football = buildFootballFormation(players, formation);
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
  options: { activeOnly?: boolean; formation?: string } = {},
): TeamLayout<TPlayer> {
  const activePlayers = options.activeOnly
    ? players.filter((player) => player.isStarter !== false)
    : [...players];

  const grouped = groupPlayersBySport(activePlayers);
  const sportKeys = Object.keys(grouped)
    .filter((key) => key !== "unknown")
    .sort((left, right) => {
      const priority = ["football", "basketball", "cricket", "unknown"];
      return priority.indexOf(left) - priority.indexOf(right);
    }) as SportKind[];

  const visibleSports = sportKeys.filter(
    (sport) => (grouped[sport] ?? []).length > 0,
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
        surface: "pitch",
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
              options.formation,
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

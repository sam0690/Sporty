export type PitchMode = "football" | "basketball" | "multisport";

export type PitchSlotConfig = {
  id: number;
  label: string;
  className: string;
};

export type PitchPlayerLike = {
  id: string;
  position: string;
  sportName?: string;
};

export type PitchLayoutItem<TPlayer extends PitchPlayerLike> = {
  slot: PitchSlotConfig;
  player: TPlayer | null;
};

const SLOT_CONFIGS: Record<PitchMode, PitchSlotConfig[]> = {
  football: [
    { id: 1, label: "ST", className: "left-[35%] top-[10%]" },
    { id: 2, label: "ST", className: "right-[35%] top-[10%]" },
    { id: 3, label: "LM", className: "left-[15%] top-[30%]" },
    { id: 4, label: "CM", className: "left-[35%] top-[30%]" },
    { id: 5, label: "CM", className: "right-[35%] top-[30%]" },
    { id: 6, label: "RM", className: "right-[15%] top-[30%]" },
    { id: 7, label: "LB", className: "left-[12%] top-[55%]" },
    { id: 8, label: "CB", className: "left-[30%] top-[55%]" },
    { id: 9, label: "CB", className: "right-[30%] top-[55%]" },
    { id: 10, label: "RB", className: "right-[12%] top-[55%]" },
    { id: 11, label: "GK", className: "left-1/2 top-[80%] -translate-x-1/2" },
  ],
  basketball: [
    { id: 1, label: "PG", className: "left-1/2 top-[15%] -translate-x-1/2" },
    { id: 2, label: "SG", className: "left-[25%] top-[30%]" },
    { id: 3, label: "SF", className: "right-[25%] top-[30%]" },
    { id: 4, label: "PF", className: "left-[30%] top-[55%]" },
    { id: 5, label: "C", className: "right-[30%] top-[55%]" },
  ],
  multisport: [
    { id: 1, label: "B1", className: "left-[20%] top-[14%]" },
    { id: 2, label: "B2", className: "right-[20%] top-[14%]" },
    { id: 3, label: "B3", className: "left-[30%] top-[30%]" },
    { id: 4, label: "B4", className: "right-[30%] top-[30%]" },
    { id: 5, label: "F1", className: "left-[15%] top-[52%]" },
    { id: 6, label: "F2", className: "right-[15%] top-[52%]" },
    { id: 7, label: "F3", className: "left-[28%] top-[68%]" },
    { id: 8, label: "F4", className: "right-[28%] top-[68%]" },
    { id: 9, label: "F5", className: "left-1/2 top-[84%] -translate-x-1/2" },
  ],
};

function inferSportName(player: PitchPlayerLike): "football" | "basketball" {
  const explicit = player.sportName?.toLowerCase();
  if (explicit === "basketball") {
    return "basketball";
  }
  if (explicit === "football") {
    return "football";
  }

  const upper = player.position.toUpperCase();
  if (
    upper.includes("PG") ||
    upper.includes("SG") ||
    upper.includes("SF") ||
    upper.includes("PF") ||
    upper === "C" ||
    upper.includes("GUARD") ||
    upper.includes("CENTER")
  ) {
    return "basketball";
  }

  return "football";
}

function detectMode(players: PitchPlayerLike[]): PitchMode {
  const sportSet = new Set(players.map((player) => inferSportName(player)));
  if (sportSet.size > 1) {
    return "multisport";
  }

  const sport = Array.from(sportSet)[0];
  if (sport === "basketball") {
    return "basketball";
  }

  return "football";
}

export function getPitchSlots(mode: PitchMode) {
  return SLOT_CONFIGS[mode];
}

export function detectPitchMode(players: PitchPlayerLike[]) {
  return detectMode(players);
}

export function buildPitchLayout<TPlayer extends PitchPlayerLike>(
  players: TPlayer[],
) {
  const pitchMode = detectMode(players);
  const pitchSlots = SLOT_CONFIGS[pitchMode];
  const orderedPlayers = players.slice();

  return {
    pitchMode,
    pitchSlots,
    items: pitchSlots.map((slot, index) => ({
      slot,
      player: orderedPlayers[index] ?? null,
    })) as PitchLayoutItem<TPlayer>[],
  };
}

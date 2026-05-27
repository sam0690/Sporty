export type AutoPickConstraint = {
  min?: number;
  max?: number;
  exact?: number;
};

export type AutoPickCandidate = {
  id: string;
  sport: string;
  position: string;
  price?: number | null;
  current_cost?: number | null;
  cost?: number | null;
  projected?: number | null;
  projected_points?: number | null;
  club?: string | null;
  real_team?: string | null;
};

export type AutoPickConstraints = {
  squadSize: number;
  positions?: Record<string, AutoPickConstraint>;
  sports?: Record<string, AutoPickConstraint>;
  maxPerClub?: number;
  lockedPlayerIds?: string[];
  bannedPlayerIds?: string[];
};

type CandidateScore<T extends AutoPickCandidate> = {
  player: T;
  cost: number;
  projectedPoints: number;
  valueScore: number;
  sportKey: string;
  positionKey: string;
  clubKey: string;
  isPreferred: boolean;
};

type Requirement = {
  type: "position" | "sport";
  key: string;
  remaining: number;
};

const WILDCARD_KEYS = new Set(["*", "all", "any", "flex"]);

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getFiniteNumber(...values: Array<number | null | undefined>): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function getPlayerCost<T extends AutoPickCandidate>(player: T): number {
  return Math.max(
    0,
    getFiniteNumber(player.price, player.current_cost, player.cost),
  );
}

function getPlayerProjectedPoints<T extends AutoPickCandidate>(
  player: T,
): number {
  return Math.max(
    0,
    getFiniteNumber(player.projected_points, player.projected),
  );
}

function getPlayerValueScore<T extends AutoPickCandidate>(player: T): number {
  const cost = getPlayerCost(player);
  const projectedPoints = getPlayerProjectedPoints(player);

  // The selector uses a single universal ranking score so the same greedy pass
  // can work across football, basketball, and mixed pools without sport-specific
  // optimization libraries. Projected points per unit cost is the common signal.
  if (cost <= 0) {
    return projectedPoints > 0 ? projectedPoints : 0;
  }

  return projectedPoints / cost;
}

function getPlayerSportKey<T extends AutoPickCandidate>(player: T): string {
  return normalizeToken(player.sport);
}

function getPlayerPositionKey<T extends AutoPickCandidate>(player: T): string {
  return normalizeToken(player.position);
}

function getPlayerClubKey<T extends AutoPickCandidate>(player: T): string {
  return normalizeToken(player.real_team ?? player.club ?? "");
}

function getCandidateConstraintKeys<T extends AutoPickCandidate>(
  player: T,
): string[] {
  const sportKey = getPlayerSportKey(player);
  const positionKey = getPlayerPositionKey(player);

  // Grouping by sport + position prevents collisions when different sports reuse
  // the same role labels. A basketball PF and a football defender should never
  // be treated as the same bucket unless the caller explicitly asks for it.
  return [`${sportKey}:${positionKey}`, sportKey, positionKey].filter(Boolean);
}

function isWildcardKey(key: string): boolean {
  return WILDCARD_KEYS.has(normalizeToken(key));
}

function matchesConstraintKey<T extends AutoPickCandidate>(
  player: T,
  key: string,
): boolean {
  const normalizedKey = normalizeToken(key);

  if (!normalizedKey) {
    return false;
  }

  if (isWildcardKey(normalizedKey)) {
    return true;
  }

  return getCandidateConstraintKeys(player).includes(normalizedKey);
}

function buildRequirementList(
  selectedPlayers: AutoPickCandidate[],
  constraints: AutoPickConstraints,
): Requirement[] {
  const requirements: Requirement[] = [];

  const pushRequirement = (
    type: Requirement["type"],
    key: string,
    rule: AutoPickConstraint,
  ) => {
    const target = rule.exact ?? rule.min ?? 0;
    if (target <= 0) {
      return;
    }

    const current = countMatches(selectedPlayers, type, key);
    const remaining = target - current;

    if (remaining > 0) {
      requirements.push({
        type,
        key: normalizeToken(key),
        remaining,
      });
    }
  };

  for (const [key, rule] of Object.entries(constraints.positions ?? {})) {
    pushRequirement("position", key, rule);
  }

  for (const [key, rule] of Object.entries(constraints.sports ?? {})) {
    pushRequirement("sport", key, rule);
  }

  // Mandatory roster roles should be solved before the catch-all flex slots.
  // That keeps the greedy pass focused on the constraints that would otherwise
  // become expensive to repair later.
  return requirements.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "position" ? -1 : 1;
    }
    if (right.remaining !== left.remaining) {
      return right.remaining - left.remaining;
    }
    return left.key.localeCompare(right.key);
  });
}

function countMatches(
  selectedPlayers: AutoPickCandidate[],
  type: Requirement["type"],
  key: string,
): number {
  if (isWildcardKey(key)) {
    return selectedPlayers.length;
  }

  if (type === "sport") {
    const normalizedSport = normalizeToken(key);
    return selectedPlayers.filter(
      (player) => getPlayerSportKey(player) === normalizedSport,
    ).length;
  }

  const normalizedKey = normalizeToken(key);
  return selectedPlayers.filter((player) =>
    matchesConstraintKey(player, normalizedKey),
  ).length;
}

function getConstraintDeficits(
  selectedPlayers: AutoPickCandidate[],
  constraints: AutoPickConstraints,
): Requirement[] {
  return buildRequirementList(selectedPlayers, constraints);
}

function createScoreMap<T extends AutoPickCandidate>(players: T[]) {
  return new Map(
    players.map((player) => {
      const cost = getPlayerCost(player);
      const projectedPoints = getPlayerProjectedPoints(player);

      return [
        player.id,
        {
          player,
          cost,
          projectedPoints,
          valueScore: getPlayerValueScore(player),
          sportKey: getPlayerSportKey(player),
          positionKey: getPlayerPositionKey(player),
          clubKey: getPlayerClubKey(player),
          isPreferred: false,
        },
      ] as const;
    }),
  );
}

function normalizeSelection<T extends AutoPickCandidate>(
  selectedPlayers: T[],
  scoreMap: Map<string, CandidateScore<T>>,
  preferredPlayerIds: Set<string>,
): CandidateScore<T>[] {
  const uniqueSelected = new Map<string, CandidateScore<T>>();

  for (const player of selectedPlayers) {
    const scoredPlayer = scoreMap.get(player.id);
    if (!scoredPlayer || uniqueSelected.has(player.id)) {
      continue;
    }

    uniqueSelected.set(player.id, {
      ...scoredPlayer,
      isPreferred: preferredPlayerIds.has(player.id),
    });
  }

  return Array.from(uniqueSelected.values());
}

function countClubUsage<T extends AutoPickCandidate>(
  selectedPlayers: CandidateScore<T>[],
): Map<string, number> {
  const usage = new Map<string, number>();

  for (const selection of selectedPlayers) {
    usage.set(selection.clubKey, (usage.get(selection.clubKey) ?? 0) + 1);
  }

  return usage;
}

function getUsedPlayerIds<T extends AutoPickCandidate>(
  selectedPlayers: CandidateScore<T>[],
): Set<string> {
  return new Set(selectedPlayers.map((selection) => selection.player.id));
}

function estimateCompletionCost<T extends AutoPickCandidate>(
  remainingPlayers: CandidateScore<T>[],
  selectedPlayers: CandidateScore<T>[],
  constraints: AutoPickConstraints,
): number {
  const selectedIds = getUsedPlayerIds(selectedPlayers);
  const sparePool = remainingPlayers
    .filter((player) => !selectedIds.has(player.player.id))
    .slice()
    .sort(
      (left, right) =>
        left.cost - right.cost || right.valueScore - left.valueScore,
    );

  const deficits = getConstraintDeficits(
    selectedPlayers.map((selection) => selection.player),
    constraints,
  );

  const selectedCost = selectedPlayers.reduce(
    (sum, selection) => sum + selection.cost,
    0,
  );

  let requiredCost = 0;
  const usedInEstimate = new Set<string>();

  for (const requirement of deficits) {
    const candidate = sparePool.find((player) => {
      if (usedInEstimate.has(player.player.id)) {
        return false;
      }

      if (requirement.type === "sport") {
        return player.sportKey === normalizeToken(requirement.key);
      }

      return matchesConstraintKey(player.player, requirement.key);
    });

    if (!candidate) {
      return Number.POSITIVE_INFINITY;
    }

    usedInEstimate.add(candidate.player.id);
    requiredCost += candidate.cost;
  }

  const slotsLeft = Math.max(0, constraints.squadSize - selectedPlayers.length);
  const flexSlots = Math.max(
    0,
    slotsLeft - deficits.reduce((sum, item) => sum + item.remaining, 0),
  );
  const remainingFlex = sparePool.filter(
    (player) => !usedInEstimate.has(player.player.id),
  );

  if (remainingFlex.length < flexSlots) {
    return Number.POSITIVE_INFINITY;
  }

  for (let index = 0; index < flexSlots; index += 1) {
    const candidate = remainingFlex[index];
    requiredCost += candidate.cost;
  }

  return selectedCost + requiredCost;
}

function canCompleteSelection<T extends AutoPickCandidate>(
  selectedPlayers: CandidateScore<T>[],
  allPlayers: CandidateScore<T>[],
  constraints: AutoPickConstraints,
  budget: number,
): boolean {
  if (selectedPlayers.length > constraints.squadSize) {
    return false;
  }

  const selectedCost = selectedPlayers.reduce(
    (sum, selection) => sum + selection.cost,
    0,
  );

  if (selectedCost > budget) {
    return false;
  }

  const remainingCost = estimateCompletionCost(
    allPlayers,
    selectedPlayers,
    constraints,
  );

  return remainingCost <= budget;
}

function selectCandidateByRequirement<T extends AutoPickCandidate>(
  selectedPlayers: CandidateScore<T>[],
  allPlayers: CandidateScore<T>[],
  constraints: AutoPickConstraints,
  budget: number,
  requirement: Requirement,
): CandidateScore<T> | null {
  const usedIds = getUsedPlayerIds(selectedPlayers);
  const clubUsage = countClubUsage(selectedPlayers);
  const remainingPlayers = allPlayers.filter(
    (player) => !usedIds.has(player.player.id),
  );

  const eligiblePlayers = remainingPlayers.filter((player) => {
    if (requirement.type === "sport") {
      return player.sportKey === normalizeToken(requirement.key);
    }

    return matchesConstraintKey(player.player, requirement.key);
  });

  const sortedPlayers = eligiblePlayers.sort(
    (left, right) =>
      right.valueScore - left.valueScore || left.cost - right.cost,
  );

  const pickBestValid = (players: CandidateScore<T>[]) =>
    players.find((candidate) => {
      const clubCount = clubUsage.get(candidate.clubKey) ?? 0;
      if (constraints.maxPerClub && clubCount >= constraints.maxPerClub) {
        return false;
      }

      const tentativeSelection = [...selectedPlayers, candidate];
      return canCompleteSelection(
        tentativeSelection,
        allPlayers,
        constraints,
        budget,
      );
    }) ?? null;

  const strictPick = pickBestValid(sortedPlayers);
  if (strictPick) {
    return strictPick;
  }

  // If the strict look-ahead is too conservative for the current budget,
  // fall back to the cheapest valid role match so the repair pass still has a
  // concrete player to work with.
  return (
    sortedPlayers
      .slice()
      .sort(
        (left, right) =>
          left.cost - right.cost || right.valueScore - left.valueScore,
      )
      .find((candidate) => {
        const clubCount = clubUsage.get(candidate.clubKey) ?? 0;
        return !constraints.maxPerClub || clubCount < constraints.maxPerClub;
      }) ?? null
  );
}

function selectBestGeneralCandidate<T extends AutoPickCandidate>(
  selectedPlayers: CandidateScore<T>[],
  allPlayers: CandidateScore<T>[],
  constraints: AutoPickConstraints,
  budget: number,
): CandidateScore<T> | null {
  const usedIds = getUsedPlayerIds(selectedPlayers);
  const clubUsage = countClubUsage(selectedPlayers);
  const remainingPlayers = allPlayers.filter(
    (player) => !usedIds.has(player.player.id),
  );

  const sortedPlayers = remainingPlayers.sort(
    (left, right) =>
      right.valueScore - left.valueScore || left.cost - right.cost,
  );

  const strictPick = sortedPlayers.find((candidate) => {
    const clubCount = clubUsage.get(candidate.clubKey) ?? 0;
    if (constraints.maxPerClub && clubCount >= constraints.maxPerClub) {
      return false;
    }

    const tentativeSelection = [...selectedPlayers, candidate];
    return canCompleteSelection(
      tentativeSelection,
      allPlayers,
      constraints,
      budget,
    );
  });

  if (strictPick) {
    return strictPick;
  }

  return (
    sortedPlayers.find((candidate) => {
      const clubCount = clubUsage.get(candidate.clubKey) ?? 0;
      return !constraints.maxPerClub || clubCount < constraints.maxPerClub;
    }) ?? null
  );
}

function removeLowestValueCandidate<T extends AutoPickCandidate>(
  selectedPlayers: CandidateScore<T>[],
  allPlayers: CandidateScore<T>[],
  constraints: AutoPickConstraints,
  budget: number,
): CandidateScore<T> | null {
  const orderedCandidates = selectedPlayers.slice().sort((left, right) => {
    if (left.isPreferred !== right.isPreferred) {
      // Existing manual picks are treated as sticky, but repair is still allowed
      // to touch them if the pool cannot produce any valid squad otherwise.
      return left.isPreferred ? 1 : -1;
    }

    return left.valueScore - right.valueScore || right.cost - left.cost;
  });

  for (const candidate of orderedCandidates) {
    const tentativeSelection = selectedPlayers.filter(
      (selection) => selection.player.id !== candidate.player.id,
    );

    if (
      canCompleteSelection(tentativeSelection, allPlayers, constraints, budget)
    ) {
      return candidate;
    }
  }

  return null;
}

function hasAllMandatoryRoles<T extends AutoPickCandidate>(
  selectedPlayers: CandidateScore<T>[],
  constraints: AutoPickConstraints,
): boolean {
  return (
    getConstraintDeficits(
      selectedPlayers.map((selection) => selection.player),
      constraints,
    ).length === 0
  );
}

/**
 * Auto-pick a squad without mutating caller state.
 *
 * The algorithm stays greedy on purpose: team sizes are small, and the goal is
 * to produce a strong valid squad quickly without introducing a full optimizer
 * or external knapsack solver. We rank by value_score, solve mandatory slots
 * first, then run a repair pass to correct budget or constraint drift.
 */
export function autoPickSquad<T extends AutoPickCandidate>(
  players: T[],
  constraints: AutoPickConstraints,
  budget: number,
  existingSelection: T[] = [],
): T[] {
  const normalizedBudget = Number.isFinite(budget) ? Math.max(0, budget) : 0;
  const normalizedSquadSize = Math.max(0, Math.floor(constraints.squadSize));

  if (normalizedSquadSize === 0 || players.length === 0) {
    return [];
  }

  const uniquePlayers = new Map<string, T>();
  for (const player of players) {
    if (!uniquePlayers.has(player.id)) {
      uniquePlayers.set(player.id, player);
    }
  }

  const scoreMap = createScoreMap(Array.from(uniquePlayers.values()));
  const preferredPlayerIds = new Set(
    existingSelection.map((player) => player.id),
  );

  const scoredPool = Array.from(scoreMap.values()).sort(
    (left, right) =>
      right.valueScore - left.valueScore || left.cost - right.cost,
  );

  let selectedPlayers = normalizeSelection(
    existingSelection,
    scoreMap,
    preferredPlayerIds,
  );

  const repairSelection = () => {
    let safetyCounter = scoredPool.length * 4 + normalizedSquadSize * 4;

    while (safetyCounter > 0) {
      safetyCounter -= 1;

      if (selectedPlayers.length > normalizedSquadSize) {
        const removal = removeLowestValueCandidate(
          selectedPlayers,
          scoredPool,
          constraints,
          normalizedBudget,
        );

        if (!removal) {
          break;
        }

        selectedPlayers = selectedPlayers.filter(
          (candidate) => candidate.player.id !== removal.player.id,
        );
        continue;
      }

      if (
        !canCompleteSelection(
          selectedPlayers,
          scoredPool,
          constraints,
          normalizedBudget,
        )
      ) {
        const removal = removeLowestValueCandidate(
          selectedPlayers,
          scoredPool,
          constraints,
          normalizedBudget,
        );

        if (!removal) {
          break;
        }

        selectedPlayers = selectedPlayers.filter(
          (candidate) => candidate.player.id !== removal.player.id,
        );
        continue;
      }

      const deficits = getConstraintDeficits(
        selectedPlayers.map((selection) => selection.player),
        constraints,
      );

      if (selectedPlayers.length < normalizedSquadSize) {
        const nextCandidate =
          deficits.length > 0
            ? selectCandidateByRequirement(
                selectedPlayers,
                scoredPool,
                constraints,
                normalizedBudget,
                deficits[0],
              )
            : selectBestGeneralCandidate(
                selectedPlayers,
                scoredPool,
                constraints,
                normalizedBudget,
              );

        if (!nextCandidate) {
          const removal = removeLowestValueCandidate(
            selectedPlayers,
            scoredPool,
            constraints,
            normalizedBudget,
          );

          if (!removal) {
            break;
          }

          selectedPlayers = selectedPlayers.filter(
            (candidate) => candidate.player.id !== removal.player.id,
          );
          continue;
        }

        const clubUsage = countClubUsage(selectedPlayers);
        if (constraints.maxPerClub) {
          const clubCount = clubUsage.get(nextCandidate.clubKey) ?? 0;
          if (clubCount >= constraints.maxPerClub) {
            break;
          }
        }

        selectedPlayers = [...selectedPlayers, nextCandidate];
        continue;
      }

      if (
        deficits.length === 0 &&
        selectedPlayers.length === normalizedSquadSize
      ) {
        break;
      }

      const removal = removeLowestValueCandidate(
        selectedPlayers,
        scoredPool,
        constraints,
        normalizedBudget,
      );

      if (!removal) {
        break;
      }

      selectedPlayers = selectedPlayers.filter(
        (candidate) => candidate.player.id !== removal.player.id,
      );
    }
  };

  // Mandatory-first selection is a dedicated stage because constraints such as
  // GK/DEF/MID/ATT slots or sport minimums must be satisfied before the greedy
  // value pass can safely spend the remaining budget on flexible players.
  repairSelection();

  while (selectedPlayers.length < normalizedSquadSize) {
    const deficits = getConstraintDeficits(
      selectedPlayers.map((selection) => selection.player),
      constraints,
    );

    const nextCandidate =
      deficits.length > 0
        ? selectCandidateByRequirement(
            selectedPlayers,
            scoredPool,
            constraints,
            normalizedBudget,
            deficits[0],
          )
        : selectBestGeneralCandidate(
            selectedPlayers,
            scoredPool,
            constraints,
            normalizedBudget,
          );

    if (!nextCandidate) {
      break;
    }

    selectedPlayers = [...selectedPlayers, nextCandidate];
  }

  // The repair pass exists because the greedy fill is intentionally optimistic.
  // It can over-select a high-value player early, so we revalidate the squad and
  // trim or swap out the worst flexible pieces until the budget and constraints
  // line up again.
  repairSelection();

  const finalSelected = selectedPlayers
    .slice()
    .sort((left, right) => {
      const leftIndex = existingSelection.findIndex(
        (player) => player.id === left.player.id,
      );
      const rightIndex = existingSelection.findIndex(
        (player) => player.id === right.player.id,
      );

      if (leftIndex !== -1 || rightIndex !== -1) {
        return (
          (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
          (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
        );
      }

      return right.valueScore - left.valueScore || left.cost - right.cost;
    })
    .map((selection) => selection.player);

  if (finalSelected.length > normalizedSquadSize) {
    return finalSelected.slice(0, normalizedSquadSize);
  }

  if (
    !hasAllMandatoryRoles(selectedPlayers, constraints) ||
    finalSelected.reduce((sum, player) => sum + getPlayerCost(player), 0) >
      normalizedBudget
  ) {
    return [];
  }

  return finalSelected;
}

import type { SportKind } from "@/lib/formation/sportRegistry";

export type PitchPlayer = {
  id: string;
  playerId: string;
  name: string;
  sport: SportKind;
  position: string;
  realTeam: string;
  cost: string;
  isStarter: boolean;
  photoUrl?: string | null;
};

export { MULTISPORT_STARTER_REQUIREMENTS } from "@/lib/formation/formationEngine";

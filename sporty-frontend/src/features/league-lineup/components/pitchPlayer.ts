import type { SportKind } from "@/components/dashboard/shared/formation/sportRegistry";

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

export const MULTISPORT_STARTER_REQUIREMENTS = {
  football: 5,
  basketball: 4,
} as const;

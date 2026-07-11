// Deterministic visual identity for a team from its name alone — so the same
// team always gets the same colour + crest across the match page, with no
// assets or backend changes. Palette is drawn from the system's accent family.

const TEAM_PALETTE = [
  "#00e07f", // football green
  "#ff6b35", // basketball orange
  "#00d4ff", // cricket cyan
  "#e2c368", // volt
  "#9b59b6", // playoff purple
  "#37aee2", // sky
  "#ffd86b", // gold
  "#ff5c8a", // pink
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export type TeamIdentity = {
  color: string;
  initials: string;
};

export function teamIdentity(name?: string | null): TeamIdentity {
  const clean = (name ?? "").trim();
  if (!clean) {
    return { color: "#a0a0aa", initials: "?" };
  }
  const color = TEAM_PALETTE[hashString(clean.toLowerCase()) % TEAM_PALETTE.length];
  const initials = clean
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return { color, initials };
}

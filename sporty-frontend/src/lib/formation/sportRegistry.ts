export type SportKind = "football" | "basketball" | "cricket" | "unknown";

export type SurfaceKind = "pitch" | "court" | "multisport" | "neutral";

export function normalizeSport(value?: string | null): SportKind {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized === "football") {
    return "football";
  }

  if (normalized === "basketball") {
    return "basketball";
  }

  if (normalized === "cricket") {
    return "cricket";
  }

  return "unknown";
}

export function getSportIcon(sport?: string | null): string {
  switch (normalizeSport(sport)) {
    case "football":
      return "⚽";
    case "basketball":
      return "🏀";
    case "cricket":
      return "🏏";
    default:
      return "•";
  }
}

export function getSportAccentClass(sport?: string | null): string {
  switch (normalizeSport(sport)) {
    case "football":
      return "border-cyan-400/20 bg-cyan-500/10 text-cyan-100";
    case "basketball":
      return "border-orange-400/20 bg-orange-500/10 text-orange-100";
    case "cricket":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
    default:
      return "border-white/10 bg-white/5 text-foreground/80";
  }
}

export function getSportShortName(sport?: string | null): string {
  switch (normalizeSport(sport)) {
    case "football":
      return "F";
    case "basketball":
      return "B";
    case "cricket":
      return "C";
    default:
      return "•";
  }
}

export function getSportSurface(sport?: string | null): SurfaceKind {
  switch (normalizeSport(sport)) {
    case "football":
      return "pitch";
    case "basketball":
      return "court";
    default:
      return "neutral";
  }
}

export function getSportSectionLabel(sport?: string | null): string {
  switch (normalizeSport(sport)) {
    case "football":
      return "Football";
    case "basketball":
      return "Basketball";
    case "cricket":
      return "Cricket";
    default:
      return "Other";
  }
}

/**
 * Real club / franchise brand colours.
 *
 * Keys are the team name exactly as it lands in `real_teams.name` (NBA
 * franchises are stored as their three-letter code, football clubs by full
 * name). Lookup normalises both sides, so casing, accents, punctuation and
 * the stray `&amp;` in "Brighton &amp; Hove Albion" don't matter.
 *
 * `BRAND` holds each club's actual primary hex, kept raw so it stays correct
 * if a light theme ever lands. Nothing renders these directly — every consumer
 * goes through `brandColor()`, which lifts the hex until it clears WCAG 1.4.11
 * (3:1 for non-text UI) against the app's near-black card surface. Clubs whose
 * primary is black or navy (Newcastle, Spurs, Brooklyn) therefore come back as
 * a light tint of themselves instead of an invisible smudge; clubs that
 * already pass (Arsenal red, Dortmund yellow, City sky) come back untouched.
 *
 * Brand colours are for borders, rings, dots, meters and low-opacity fills
 * only. Text stays on the neutral `fg-*` tokens — a 3:1 colour is legible as a
 * 2px ring and illegible as 10px type.
 */

const BRAND: Record<string, string> = {
  // ── Premier League ────────────────────────────────────────────────────
  Arsenal: "#EF0107",
  "Aston Villa": "#670E36",
  Bournemouth: "#DA291C",
  Brentford: "#E30613",
  "Brighton & Hove Albion": "#0057B8",
  Burnley: "#6C1D45",
  Chelsea: "#034694",
  "Crystal Palace": "#1B458F",
  Everton: "#003399",
  // White/black kit — the crest red is the only identifiable chromatic cue.
  Fulham: "#CC0000",
  "Leeds United": "#FFCD00",
  Liverpool: "#C8102E",
  "Manchester City": "#6CABDD",
  "Manchester United": "#DA020E",
  "Newcastle United": "#241F20",
  "Nottingham Forest": "#DD0000",
  Sunderland: "#EB172B",
  "Tottenham Hotspur": "#132257",
  "West Ham United": "#7A263A",
  Wolverhampton: "#FDB913",
  // Tagged EPL in real_teams but currently outside the top flight.
  "Coventry City": "#6EC4E8",
  "Hull City": "#F18A01",
  "Ipswich Town": "#0044A9",

  // ── La Liga ───────────────────────────────────────────────────────────
  Alaves: "#0761AF",
  "Athletic Club": "#EE2523",
  "Atletico Madrid": "#CB3524",
  Barcelona: "#A50044",
  "Celta Vigo": "#8AC3EE",
  "Deportivo La Coruna": "#0067B1",
  Elche: "#00933C",
  Espanyol: "#007FC8",
  Getafe: "#005999",
  Levante: "#004B9B",
  Malaga: "#0071CE",
  Osasuna: "#D91A21",
  "Racing Santander": "#00A550",
  "Rayo Vallecano": "#E53027",
  "Real Betis": "#00954C",
  "Real Madrid": "#FEBE10",
  "Real Sociedad": "#0067B1",
  Sevilla: "#D81920",
  Valencia: "#F18E00",
  Villarreal: "#FFE667",

  // ── Bundesliga ────────────────────────────────────────────────────────
  "1. FC Köln": "#ED1C24",
  "1899 Hoffenheim": "#1C63B7",
  "Bayer Leverkusen": "#E32219",
  "Bayern München": "#DC052D",
  "Borussia Dortmund": "#FDE100",
  "Borussia Mönchengladbach": "#009B3A",
  "Eintracht Frankfurt": "#E1000F",
  "FC Augsburg": "#BA3733",
  "FC Schalke 04": "#004D9D",
  "FSV Mainz 05": "#C3141E",
  "Hamburger SV": "#003D7D",
  "RB Leipzig": "#DD0741",
  "SC Freiburg": "#E2001A",
  "SC Paderborn 07": "#005CA9",
  "SV Elversberg": "#E2001A",
  "Union Berlin": "#EB1923",
  "VfB Stuttgart": "#E32219",
  "Werder Bremen": "#1D9053",

  // ── NBA (stored as three-letter codes) ────────────────────────────────
  ATL: "#E03A3E",
  BKN: "#000000",
  BOS: "#007A33",
  CHA: "#1D1160",
  CHI: "#CE1141",
  CLE: "#860038",
  DAL: "#00538C",
  DEN: "#0E2240",
  DET: "#C8102E",
  GSW: "#1D428A",
  HOU: "#CE1141",
  IND: "#002D62",
  LAC: "#C8102E",
  LAL: "#552583",
  MEM: "#5D76A9",
  MIA: "#98002E",
  MIL: "#00471B",
  MIN: "#0C2340",
  NOP: "#0C2340",
  NYK: "#F58426",
  OKC: "#007AC1",
  ORL: "#0077C0",
  PHI: "#006BB6",
  PHX: "#1D1160",
  POR: "#E03A3E",
  SAC: "#5A2D81",
  SAS: "#C4CED4",
  TOR: "#CE1141",
  UTA: "#002B5C",
  WAS: "#002B5C",
};

/** Name variants that reach us from feeds and CSV imports, not from the DB. */
const ALIASES: Record<string, string> = {
  "Liverpool FC": "Liverpool",
  "Man Utd": "Manchester United",
  "Man United": "Manchester United",
  "Man City": "Manchester City",
  Spurs: "Tottenham Hotspur",
  Tottenham: "Tottenham Hotspur",
  Brighton: "Brighton & Hove Albion",
  Wolves: "Wolverhampton",
  "Wolverhampton Wanderers": "Wolverhampton",
  "West Ham": "West Ham United",
  Newcastle: "Newcastle United",
  Leeds: "Leeds United",
  "Bayern Munich": "Bayern München",
  "Borussia Monchengladbach": "Borussia Mönchengladbach",
  "FC Koln": "1. FC Köln",
  "FC Barcelona": "Barcelona",
};

/** Lowercase, strip accents/entities/punctuation — "Brighton &amp; Hove
 *  Albion", "brighton & hove albion" and "Brighton and Hove Albion" all have
 *  to reach the same key. */
export function normalizeTeamName(name: string): string {
  return name
    .replace(/&amp;/gi, "&")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\band\b/g, "&")
    .replace(/[^a-z0-9]/g, "");
}

const LOOKUP = new Map<string, string>();
for (const [name, hex] of Object.entries(BRAND)) {
  LOOKUP.set(normalizeTeamName(name), hex);
}
for (const [alias, canonical] of Object.entries(ALIASES)) {
  const hex = BRAND[canonical];
  if (hex) {
    LOOKUP.set(normalizeTeamName(alias), hex);
  }
}

// ── Contrast tuning ─────────────────────────────────────────────────────

/** Cards (`--surface-1`). Lighter than the page floor, so it is the worse of
 *  the two backgrounds for a light-ish accent — tune against it and both hold. */
const SURFACE = "#111117";
/** WCAG 1.4.11 asks 3:1 for non-text UI; the extra 0.5 is headroom for the
 *  low-opacity fills these colours also drive. */
const MIN_CONTRAST = 3.5;

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(parseHex(a)), relativeLuminance(parseHex(b))].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
}

/** Blend toward white until the colour clears `MIN_CONTRAST` on `SURFACE`.
 *  Hue survives the blend, so a lifted colour still reads as the club's —
 *  Newcastle's near-black becomes a warm pale grey, which is the right answer
 *  for a black-and-white kit anyway. Terminates because white is 18:1 here. */
function liftForDark(hex: string): string {
  const rgb = parseHex(hex);
  for (let step = 0; step <= 100; step += 1) {
    const t = step / 100;
    const mixed = rgb.map((c) => c + (255 - c) * t) as Rgb;
    if (contrastRatio(toHex(mixed), SURFACE) >= MIN_CONTRAST) {
      return toHex(mixed);
    }
  }
  return "#ffffff";
}

const tuned = new Map<string, string>();

/**
 * The team's brand colour, adjusted to be safe on the app's dark surfaces.
 * `null` when we have no colour on file — callers fall back to a neutral
 * rather than inventing one, because a wrong club colour reads worse than
 * no colour at all.
 */
export function brandColor(name?: string | null): string | null {
  const key = normalizeTeamName((name ?? "").trim());
  const raw = key ? LOOKUP.get(key) : undefined;
  if (!raw) {
    return null;
  }
  let out = tuned.get(raw);
  if (!out) {
    out = liftForDark(raw);
    tuned.set(raw, out);
  }
  return out;
}

// ── Same-colour clashes ─────────────────────────────────────────────────
// Two clubs in one fixture must never render the same colour: Liverpool vs
// Manchester United is two near-identical reds, and a red dot on each side of
// the event feed's spine tells you nothing. Football solves this with a change
// strip, and so do we — the HOME side always keeps its true colour and the
// away side shifts, which matches both the real convention and the reader's
// expectation that the home club looks "right".

/** Perceptual-ish RGB distance ("redmean") — good enough to answer "would a
 *  reader confuse these two dots?" without dragging in a Lab colour library.
 *  Range is roughly 0 (identical) to 765 (black vs white). */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db,
  );
}

/** Below this, two colours read as "the same one" at dot/bar/ring size.
 *  Calibrated against the real clashes in BRAND — see the teamColors test. */
export const MIN_TEAM_SEPARATION = 120;

function rotateHue(hex: string, degrees: number): string {
  const [r, g, b] = parseHex(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return hex; // greys have no hue to rotate
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h =
    max === r
      ? (g - b) / d + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  h = (h / 6 + degrees / 360 + 1) % 1;

  const hueToRgb = (p: number, q: number, t: number) => {
    const tt = (t + 1) % 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return toHex([
    hueToRgb(p, q, h + 1 / 3) * 255,
    hueToRgb(p, q, h) * 255,
    hueToRgb(p, q, h - 1 / 3) * 255,
  ]);
}

function mixWhite(hex: string, amount: number): string {
  return toHex(parseHex(hex).map((c) => c + (255 - c) * amount) as Rgb);
}

/**
 * A colour for `away` that a reader won't confuse with `home`.
 *
 * Tries, in order: the club's own colour; a pale tint of it (still obviously
 * the same family, the way a change strip usually is); then hue rotations,
 * which are the last resort because they stop reading as the club's colour.
 * Every candidate is re-tuned for the dark surface, and if nothing clears the
 * bar we take the furthest one rather than giving up — the guarantee is
 * "never identical", so it has to hold for every input.
 */
export function separateFromHome(awayHex: string, homeHex: string): string {
  const candidates = [
    awayHex,
    liftForDark(mixWhite(awayHex, 0.45)),
    liftForDark(rotateHue(awayHex, 35)),
    liftForDark(rotateHue(awayHex, -35)),
    liftForDark(rotateHue(awayHex, 80)),
    // Greys can't be rotated, so give them somewhere else to go entirely.
    liftForDark(mixWhite(awayHex, 0.7)),
  ];
  let best = awayHex;
  let bestDistance = -1;
  for (const candidate of candidates) {
    const distance = colorDistance(candidate, homeHex);
    if (distance >= MIN_TEAM_SEPARATION) {
      return candidate;
    }
    if (distance > bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** Exposed for the contrast test — not for rendering. */
export const BRAND_COLORS = BRAND;
export const DARK_SURFACE = SURFACE;
export const MIN_BRAND_CONTRAST = MIN_CONTRAST;

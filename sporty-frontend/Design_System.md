# Sporty — Design System ("Ink & Gold")

The single source of truth for the frontend's look. Tokens live in `src/app/globals.css` (`:root` + `@theme inline`); components consume them as Tailwind classes (`bg-accent`, `text-fg-2`, `bg-surface-1`, …). **Never hardcode a hex in a component** — the only exceptions are listed in §7.

## 1. Philosophy

- **Ink canvas, gold storytelling.** Near-black matte surfaces; champagne gold appears only where it earns its place: points, ranks, live states, and the single primary action of a screen.
- **Broadcast sharpness.** 3px radii, hairline borders, flat surfaces. One subtle depth cue (`.card-surface`), no glows on idle elements.
- **Numbers are first-class.** Tabular numerals (`.num`) on every score, rank, price, countdown.
- **Sport identities are separate from status colors.** Football green ≠ success green.

## 2. Color Tokens

### Surfaces (ink scale)
| Token | Value | Tailwind | Use |
|-------|-------|----------|-----|
| `--surface-0` | `#0a0a0f` | `bg-surface-0` | page floor |
| `--surface-1` | `#111117` | `bg-surface-1` / `.card-surface` | cards |
| `--surface-2` | `#0d0d12` | `bg-surface-2` | inset tiles, inputs, bar tracks |
| `--surface-3` | `#1d1d26` | `bg-surface-3` | elevated / hover / secondary buttons |

### Accent (champagne gold)
| Token | Value | Use |
|-------|-------|-----|
| `--accent` | `#e2c368` | primary CTA fill, key numbers, live/active markers |
| `--accent-bright` | `#f0d382` | hover state of gold fills |
| `--accent-dim` | `#b39a55` | de-emphasised accent (visited, secondary numerals) |

**Accent budget:** per screen, gold marks points/rank numbers, live states, and **one** primary CTA. Everything else is ink + hairline (`border-white/12 text-fg-1 hover:border-accent/40`). Tinted chips use `bg-accent/8 border-accent/25`.

### Text tiers
| Token | Value | Tailwind | Use |
|-------|-------|----------|-----|
| `--fg-1` | `#f2f2f0` | `text-fg-1` | headlines, primary copy |
| `--fg-2` | `#a0a0aa` | `text-fg-2` | body, secondary copy |
| `--fg-3` | `#71717d` | `text-fg-3` | hints, timestamps (≥4:1 on surface-1 — do not go darker) |

### Status
| Token | Value | Use |
|-------|-------|-----|
| `--danger` | `#ff3b5c` | errors, negative deltas, live badge |
| `--danger-soft` | `#ff8a8a` | error copy on dark tinted panels |
| `--success` | `#00e07f` | positive feedback, goals, subbed-in |
| `--warning` | `#ffd86b` | deadlines, closed states |
| `--info` | `#00d4ff` | informational accents |

### Sport identities (never repurpose as status)
`--football #00ff88 · --basketball #ff6b35 · --cricket #00d4ff · --rugby #e040fb · --playoff #9b59b6 · --gold #ffd86b` + pitch surfaces `--grass`, `--court`. Consumed by formation renderers, `sportGlyph`, sport badges.

### Opacity forms
Use slash opacity, not rgba literals: `border-white/8` (hairline), `bg-accent/10`, `border-danger/25`, etc.

## 3. Typography

Loaded in `src/app/layout.tsx`: **Inter** (400–900) = `--font-display`, **DM Sans** (400–700) = `--font-sans`.

| Role | Class | Weight | Tracking |
|------|-------|--------|----------|
| Display numerals / hero headlines | `font-display` | 800–900 | `tracking-[-0.02em]` |
| Section titles | `font-display` (h1–h6 default) | 800 | `-0.02em` |
| Body | `font-sans` | 400–500 | normal |
| Micro-labels ("TOTAL POINTS") | `.section-label` / `font-sans` 10–12px uppercase | 700 | `0.25em` (wide tracking is for micro-labels ONLY) |
| Stats | add `.num` | — | tabular-nums |

## 4. Shape, Depth, Spacing

- Radius: `--radius: 3px` everywhere (`rounded-[3px]`; scale sm=2px … 2xl=6px). Circles only for avatars, status dots, spinners.
- **`.card-surface`** — the standard page-level card: surface-1 + `border-white/8` hairline + inset top-edge highlight. The only idle depth cue. Nested tiles use plain `bg-surface-2`/`bg-surface-3`.
- Shadows: overlays only (toast uses `0 12px 32px rgba(0,0,0,0.5)`). No glows, no gradients on idle surfaces. Solid fills for bars/strips.
- Spacing: 4px rhythm; card padding `p-4`–`p-6`; page `max-w-7xl`.

## 5. Motion

- Interactive transitions 150–200ms `cubic-bezier(0.4,0,0.2,1)` (set globally on `button`/`a`/`tr`); press = `scale(0.98)`.
- Entrances: `.animate-fade-in`, `.pop-in` (0.25–0.5s ease-out). Loading: `.skeleton` shimmer.
- `.animate-live-pulse` for live dots. All ambient animation is disabled under `prefers-reduced-motion`.

## 6. Focus & A11y

- `:focus-visible` ring is never suppressed; ring color is gold (`--ring`).
- Body text ≥ `--fg-2`; hints ≥ `--fg-3`; `.section-label` is `rgba(255,255,255,0.55)`.
- Gold on ink ≈ 10:1; black text on gold CTAs ≈ 12:1.

## 7. Allowed hex literals in components

Hex is allowed **only** where CSS `var()` can't reach or values are intentionally foreign:
1. JS color constants that get alpha-suffix concatenated (`` `${color}1a` ``) — sport accent maps, `lib/teamIdentity.ts`. Use the canonical token values above.
2. Third-party brand colors (Google logo in `SocialLogin`).
3. Medal colors (`#ffd86b` gold, `#c8d0dc` silver, `#cd7f32` bronze).

Everything else: Tailwind token classes, or `var(--…)` in inline styles.

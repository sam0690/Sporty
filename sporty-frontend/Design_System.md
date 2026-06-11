# Fantasy Club — Design System

A complete spec for the dark-matte, neon, sports-narrative aesthetic used in this prototype. Hand this file to any developer and they can reproduce the same look, feel, and motion language without reading component source.

---

## 1. Overview

**Purpose** — A multi-sport fantasy club UI built around two experiences:
1. **The Journey** — a single-page vertical scroll telling the story of a season from Draft Day (bottom) to Championship (top).
2. **The Dashboard** — a management surface for editing teams across Football, Basketball, and a Mix view.

**Core philosophy**
- **Dark matte canvas, neon storytelling.** The base is near-black (`#0A0A0F`). Color earns its place — it appears only where the narrative needs energy (active state, live stat, sport accent, championship gradient).
- **Three sport identities, never blended.** Football = neon green, Basketball = orange, Mix/Playoffs = purple. Every surface, button, and stat inherits the active sport accent.
- **Motion is meaning.** Glitch = chaos of draft. Flicker = locker-room neon. Scroll-linked transforms = passage of time. Confetti + 3D trophy = catharsis.
- **Tabular numbers everywhere.** Stats are first-class typography.
- **Glass over solid.** Frosted surfaces let the parallax backgrounds breathe.

---

## 2. Color Tokens

All tokens live in `src/styles.css` under `:root` and `@theme inline`.

### Surface (oklch)
```css
--background:        oklch(0.13 0.01 270);   /* page bg, paired with hard #0A0A0F on <body> */
--foreground:        oklch(0.98 0.005 270);
--card:              oklch(0.17 0.015 270);
--card-foreground:   oklch(0.98 0.005 270);
--muted:             oklch(0.22 0.02 270);
--muted-foreground:  oklch(0.70 0.02 270);
--border:            oklch(1 0 0 / 0.1);
--input:             oklch(1 0 0 / 0.15);
```
Body background is hardcoded to `#0A0A0F` in `@layer base` to guarantee the matte black floor under glass layers.

### Brand neons (exact hex — non-negotiable)
```css
--football:   #00FF88;   /* soccer accent */
--basketball: #FF6B35;   /* basketball accent */
--playoff:    #9B59B6;   /* mix / playoffs / championship secondary */
--grass:      #0E3D1F;   /* football field deep green */
--court:      #4A2510;   /* basketball court hardwood */
```

### Gradients
```css
--gradient-football:   linear-gradient(135deg, #00FF88 0%, #00B86B 100%);
--gradient-basketball: linear-gradient(135deg, #FF6B35 0%, #C8390F 100%);
--gradient-playoff:    linear-gradient(135deg, #9B59B6 0%, #6A2C91 100%);
--gradient-champion:   linear-gradient(135deg, #FFD86B 0%, #FF6B35 50%, #9B59B6 100%);
```
The champion gradient is reserved for #1 rank, trophy halo, and the `CHAMPION` headline.

### Neon glow shadows
```css
--shadow-neon-green:  0 0 24px color-mix(in oklab, #00FF88 60%, transparent);
--shadow-neon-orange: 0 0 24px color-mix(in oklab, #FF6B35 60%, transparent);
--shadow-neon-purple: 0 0 24px color-mix(in oklab, #9B59B6 60%, transparent);
```
**Rule:** glows attach to *active* and *hover* states only — never to idle surfaces. A page full of always-on glows kills the signal.

### Text contrast floor
Body copy never goes below `rgba(255,255,255,0.7)`. Micro-labels use `0.5`–`0.6`. Never use pure `#FFFFFF` for non-headline body text.

---

## 3. Typography

```css
--font-display: "Inter",   ui-sans-serif, system-ui, sans-serif;
--font-sans:    "DM Sans", ui-sans-serif, system-ui, sans-serif;
```

| Role | Family | Weight | Tracking | Notes |
|------|--------|--------|----------|-------|
| Hero headlines (`DRAFT DAY`, `CHAMPION`) | Inter | 900 (black) | `-0.02em` to `-0.04em` | Sizes up to `18vw` / `140px`. Use `font-display` class. |
| Section titles | Inter | 800 | `-0.02em` | `text-xl` to `text-2xl`. |
| Card titles / player names | Inter | 800 | normal | `text-sm` to `text-lg`. |
| Body | DM Sans | 400–500 | normal | `text-sm`, line-height relaxed. |
| Micro-labels | DM Sans | 700 | `0.25em`–`0.4em`, `UPPERCASE` | `text-[10px]`. Used for "WEEK POINTS", "SCROLL UP", "LIVE". |
| Stats / numbers | Inter | 800–900 | `tabular-nums` | Apply `.num` or `.tabular` utility — see below. |

```css
.num, .tabular {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```
Every score, rank, currency, and countdown gets `.num`. Non-negotiable for the data-dense feel.

**Fonts must be loaded** via `<link>` in `src/routes/__root.tsx` head (Google Fonts or self-hosted). Defining `--font-display` only names the family — it does not load it.

---

## 4. Spacing & Shape

| Token | Value | Use |
|-------|-------|-----|
| Radius `sm` | `calc(--radius - 4px)` | Inputs, badges |
| Radius `md` | `calc(--radius - 2px)` | Small cards |
| Radius `lg` | `0.875rem` (base `--radius`) | Standard cards |
| Radius `xl` | `calc(--radius + 4px)` | Hero glass cards |
| Radius `2xl` | `calc(--radius + 8px)` | Stat blocks, summary cards |
| Pill | `9999px` (`rounded-full`) | All buttons, nav chips, status pills |

| Layout | Value |
|--------|-------|
| Section min-height (journey) | `min-h-[110vh]` — guarantees overlap into parallax scroll math |
| Page max-width (dashboard) | `max-w-7xl` |
| Page max-width (journey content) | `max-w-6xl` |
| Section horizontal padding | `px-4` mobile, `px-6` desktop |
| Section vertical padding | `py-24` |
| Card padding | `p-3` (compact), `p-4`–`p-5` (default) |
| Grid gap | `gap-3` or `gap-4` |

---

## 5. Glassmorphism

Two flavors only. Resist inventing more.

```css
.glass {
  background: color-mix(in oklab, #ffffff 4%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid color-mix(in oklab, #ffffff 10%, transparent);
  border-radius: 0.875rem;
}
.glass-strong {
  background: color-mix(in oklab, #ffffff 7%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid color-mix(in oklab, #ffffff 14%, transparent);
}
```
- `.glass` — chips, secondary buttons, scroll cues, status pills.
- `.glass-strong` — primary cards, sticky header, summary cards, leaderboard rows.

**Never** apply glass to a full-bleed background. It needs something behind it (gradient, parallax shape, photo wash) to shimmer.

---

## 6. Motion System

Motion lives in three registers. Pick the right one for the job.

### 6a. Framer Motion springs (component-level)

Reusable spring configs:

| Use | `stiffness` | `damping` | `mass` |
|-----|-------------|-----------|--------|
| Card snap-in on scroll | `120` | `14` | default |
| Magnetic button follow | `250` | `18` | `0.4` |
| Custom cursor follow | `350` | `28` | `0.4` |
| Squad swap (`layout`) | `220` | `22` | default |
| Trophy float | `120` | — | — (via `<Float>` drei) |

Standard scroll-in card pattern:
```tsx
<motion.div
  initial={{ x: side === "L" ? -400 : 400, opacity: 0, rotate: -8 }}
  whileInView={{ x: 0, opacity: 1, rotate: -3 }}
  viewport={{ once: false, amount: 0.4 }}
  transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.1 + i * 0.12 }}
/>
```
Stagger via `delay: base + i * 0.12`.

### 6b. CSS keyframes (ambient)

All defined in `src/styles.css`. Apply by class.

| Class | Keyframe | Duration | Where |
|-------|----------|----------|-------|
| `.glitch` | `glitch-rgb` — RGB text-shadow split + `translate` jitter | `2.8s steps(1, end) infinite` | `DRAFT DAY` headline |
| `.flicker` | `neon-flicker` — opacity dips at 45%/47%/60%/62% | `3s infinite` | Locker-room neon strips. Stagger via `animation-delay`. |
| `.lightning` | `lightning-flash` — full opacity burst at 93%/96% | `4.5s infinite` | Playoffs storm overlay |
| `.float-up` | `translateY(20px) → 0` + fade | `0.6s ease-out both` | Section reveals |
| `.spin-y` | `rotateY 0 → 360deg` | `8s linear infinite` | LotteryBall outer ring |
| `.ball-roll` | `translateX(-10vw → 110vw) + rotate(720)` | `8s linear infinite` | Regular Season football pass |
| `.bball-bounce` | parabolic translate + rotate | `7s linear infinite` | Regular Season basketball |
| `firework-up` (inline) | `translateY(-60vh) scale(8)` + fade | `2.4s ease-out infinite` | Championship fireworks |

### 6c. Scroll-linked transforms

```tsx
const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
const skew    = useTransform(scrollYProgress, [0, 1], [12, -12]);
const tracking = useTransform(scrollYProgress, [0, 1], ["-0.04em", "0.08em"]);
const scale   = useTransform(scrollYProgress, [0, 1], [0.92, 1.05]);
```
Applied to the `CHAMPION` headline so it kinetically "tightens" as the user scrolls through it.

### Parallax depth ladder
| Layer | Multiplier on scroll Y | Examples |
|-------|------------------------|----------|
| Background | `0.3×` | Stadium lights, stars, gradient washes |
| Mid | `0.6×` | Stat clouds, lockers, court lines |
| Foreground | `1×` (no transform) | Cards, headlines, buttons |

### Easing
Default `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind `ease-in-out`). Springs replace easing for anything snappy.

---

## 7. Component Catalog

### NavHeader
Three pill buttons (⚽ ⚾ 🟣) fixed top-center. Each scrolls to its section via `element.scrollIntoView({ behavior: "smooth", block: "start" })`. Active button gets the matching sport gradient + neon shadow.

### LotteryBall (`src/components/journey/LotteryBall.tsx`)
Pure CSS 3D — no WebGL. Recipe:
- Wrapper: `perspective: 900`, `260px × 260px`.
- Outer ring: `.spin-y` + `transform-style: preserve-3d`.
- Glass shell: radial gradient highlight at 30% 25%, inset green + purple glow.
- Equator + two `rotateY(±60deg)` rings for orbital lines.
- Player chips: `translate(-50%,-50%) rotateY(${i*360/N}deg) translateZ(110px)` to orbit them on faces.
- Center sparkle: `3×3` white dot with `box-shadow: 0 0 24px 8px rgba(255,255,255,0.8)`.

### PlayerCard (journey)
- `glass` wrapper, `w-44`, `p-3`, `shadow-neon-purple`.
- Top: 80px gradient swatch (sport-tinted).
- Bottom row: name (Inter 800), uppercase position label, `#rank` in `.num`.
- Flies in from off-screen with rotated rest pose (`rotate: ±3deg`).

### PlayerCard (dashboard)
- `glass-strong`, full-width, `p-3`.
- 56×56 gradient avatar with initials in black Inter 900.
- Status dot (`fit` green / `questionable` yellow / `out` red) with matching glow.
- Right column: large `.num` points in sport accent color.
- Hover: `-translate-y-0.5`.

### StatCloud
Floating stat chips that drift on parallax mid layer during Regular Season. Use `useTransform(scrollYProgress, [0,1], [0, -200])` on Y, with horizontal sway via `Math.sin(scrollYProgress)`.

### TensionMeter (Playoffs)
A horizontal "rope" between two nodes (YOU vs RIVAL). Width derived from `useTransform` on scroll progress so the gap visually tightens. Stroke is `gradient-playoff` with `shadow-neon-purple` on the lead node.

### Trophy3D (`@react-three/fiber`)
- Canvas `camera={{ position: [0, 1.1, 4], fov: 38 }}`, `dpr={[1, 2]}`.
- Cup body: `cylinderGeometry [0.85, 0.55, 1.3, 64]` + `MeshTransmissionMaterial` (gold `#FFD86B`, transmission `0.6`, chromatic aberration `0.06`).
- Rim torus, two side handles (half-torus `Math.PI`), stem, base, plaque.
- Lights: ambient `0.6`, key directional `1.4`, fill purple directional `0.6`.
- Wrap in `<Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.8}>`.
- `<Environment preset="city" />` for chrome reflections.
- Radial gold→purple glow halo behind the canvas via blurred div.

### MagneticButton
Captures `mousemove`, calculates offset from center, springs `x`/`y` by `strength * 0.35`. Resets on `mouseleave`. Always include `data-magnetic` so the CustomCursor can detect it.

### CustomCursor
Desktop only (`window.matchMedia("(pointer: fine)").matches`). Hides native cursor via `body.has-glow-cursor *` rule. Ring (32px white border with inset + outer glow) springs to pointer; inner 6px dot tracks raw. Ring scales `1.8×` over interactive elements.

### ResetFAB
Bottom-right `MagneticButton` that runs `window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })` to return to Draft Day.

### Dashboard — SummaryCard
- `glass-strong`, `p-5`, `rounded-2xl`.
- Top row: sport accent micro-label + `Rank #N` chip.
- Team name (Inter 800, `text-2xl`).
- Big `.num` points (`text-4xl`, black).
- Footer: `Next: <opponent>`.

### Dashboard — MixCard
- Same shell as SummaryCard with a `gradient-playoff` blurred orb in the corner.
- Combined total in `gradient-champion bg-clip-text text-transparent`.
- Two-column FB/BB breakdown grid.

### Dashboard — LiveFeed
- `glass-strong`, scrollable (`max-h-[360px] overflow-y-auto`).
- Items animate in with `motion + AnimatePresence + layout`.
- Pulse dot on "LIVE" label using Tailwind `animate-pulse`.
- Delta: green if `+`, red if `-`.

### Dashboard — TransferPanel
- Two side-by-side cards with `ArrowLeftRight` icon between.
- One-tap substitute button uses `gradient-playoff` + `shadow-neon-purple`.
- Bench list below with mini avatars (`h-8 w-8`).

---

## 8. Scroll Journey Architecture

The page tells a season in reverse: DOM order is **Championship → Playoffs → Regular Season → Draft Day**, but the user lands at the bottom (Draft) and scrolls UP to relive the climb.

```tsx
// src/routes/index.tsx
useEffect(() => {
  setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" }), 0);
}, []);
```

Every section follows the same composition:

```
<section min-h-[110vh] relative isolate overflow-hidden>
  ├── Fixed/absolute background (gradient + parallax shapes, pointer-events-none)
  ├── Mid layer (parallax stat clouds / lockers / lights)
  ├── Foreground content (max-w-6xl grid)
  └── Scroll cue (bottom-centered "scroll up" label + gradient line)
</section>
```

Section vibe map:
| Section | Backdrop | Signature motion |
|---------|----------|------------------|
| Draft Day | Locker grid + flickering neon strips | `.glitch` headline, spinning LotteryBall, cards flying in |
| Regular Season | Split football/basketball court | `.ball-roll` + `.bball-bounce` across screen, drifting StatCloud |
| Playoffs | Storm gradient + `.lightning` flashes | TensionMeter rope tightens with scroll |
| Championship | Gold→purple radial + fireworks | 3D trophy, kinetic CHAMPION headline, confetti burst on `useInView` |

---

## 9. Dashboard Architecture

Sport selection drives the entire theme via React state. The active accent maps to gradient, text color, and shadow:

```ts
const accentMap = {
  football:   { text: "text-football",   grad: "gradient-football",   ring: "shadow-neon-green"  },
  basketball: { text: "text-basketball", grad: "gradient-basketball", ring: "shadow-neon-orange" },
  mix:        { text: "text-playoff",    grad: "gradient-playoff",    ring: "shadow-neon-purple" },
};
```

Layout grid:
- **Header**: sticky `glass-strong`, brand mark left, gameweek center, budget chip right.
- **Sport switcher**: pill row, active = filled gradient + neon shadow + black text.
- **Summary**: 3-column grid (`md:grid-cols-3`) — Football / Basketball / Mix cards.
- **Upcoming + LiveFeed**: 3-col split (`lg:grid-cols-3`), upcoming spans 2 cols with horizontal `snap-x snap-mandatory` carousel.
- **Squad + Transfers**: same 3-col split, squad as `sm:grid-cols-2`.
- **Leaderboard**: full-width `glass-strong` rounded list, `you` row gets subtle `bg-white/[0.04]` and accent text.
- **FAB**: bottom-right Transfer button, accent-themed.

---

## 10. Signature Effects (copy-paste recipes)

### RGB glitch
```css
@keyframes glitch-rgb {
  0%, 100% { text-shadow: 2px 0 #00FF88, -2px 0 #FF6B35; transform: translate(0); }
  20%      { text-shadow: -2px 0 #00FF88, 2px 0 #FF6B35; transform: translate(-1px, 1px); }
  40%      { text-shadow: 2px 2px #9B59B6, -2px -2px #00FF88; transform: translate(1px, -1px); }
  60%      { text-shadow: -2px 2px #FF6B35, 2px -2px #9B59B6; transform: translate(-1px, 0); }
  80%      { text-shadow: 2px -2px #00FF88, -2px 2px #FF6B35; transform: translate(1px, 1px); }
}
.glitch { animation: glitch-rgb 2.8s infinite steps(1, end); }
```

### Neon flicker
```css
@keyframes neon-flicker {
  0%, 100% { opacity: 1; } 45% { opacity: 0.95; } 47% { opacity: 0.55; }
  48% { opacity: 1; } 60% { opacity: 0.85; } 62% { opacity: 0.6; } 64% { opacity: 1; }
}
.flicker { animation: neon-flicker 3s infinite; }
```

### Lightning flash
```css
@keyframes lightning-flash {
  0%, 92%, 100% { opacity: 0; } 93% { opacity: 1; }
  95% { opacity: 0.2; } 96% { opacity: 1; } 98% { opacity: 0; }
}
.lightning { animation: lightning-flash 4.5s infinite; }
```

### Football roll
```css
@keyframes ball-roll {
  from { transform: translateX(-10vw) rotate(0deg); }
  to   { transform: translateX(110vw) rotate(720deg); }
}
.ball-roll { animation: ball-roll 8s linear infinite; }
```

### Basketball bounce
```css
@keyframes bball-bounce {
  0%   { transform: translate(-10vw, 0)  rotate(0deg); }
  25%  { transform: translate(25vw, -60px) rotate(180deg); }
  50%  { transform: translate(60vw, 0)  rotate(360deg); }
  75%  { transform: translate(80vw, -40px) rotate(540deg); }
  100% { transform: translate(110vw, 0) rotate(720deg); }
}
.bball-bounce { animation: bball-bounce 7s linear infinite; }
```

### Firework burst (inline animation per particle)
```css
@keyframes firework-up {
  0%   { transform: translateY(0)     scale(1); opacity: 1; }
  60%  { transform: translateY(-60vh) scale(1); opacity: 1; }
  100% { transform: translateY(-60vh) scale(8); opacity: 0; }
}
```

### Confetti burst
```tsx
import Confetti from "react-confetti";
const inView = useInView(ref, { amount: 0.4 });
useEffect(() => { if (inView) setConfettiOn(true); /* off after 6.5s */ }, [inView]);
<Confetti width={w} height={h} numberOfPieces={350} gravity={0.25} recycle={false}
  colors={["#FFD86B", "#FF6B35", "#9B59B6", "#00FF88", "#ffffff"]} />
```

### Share Victory (native + clipboard fallback)
```ts
if (navigator.share) await navigator.share({ title, text, url });
else { await navigator.clipboard.writeText(url); toast.success("Link copied! Share your victory."); }
```

---

## 11. Accessibility

- **Reduced motion** — wrap all keyframe-driven decoration in `@media (prefers-reduced-motion: reduce) { .glitch, .flicker, .lightning, .spin-y, .ball-roll, .bball-bounce { animation: none; } }`.
- **Glow restraint** — neon `box-shadow` only on hover/active/`you`-row, never on idle bulk content. Prevents bloom haze on long scrolls.
- **Contrast** — body text minimum `rgba(255,255,255,0.7)` on `#0A0A0F` (~AA). Micro-labels under `0.6` are decorative only and always paired with adjacent strong text.
- **Touch** — `CustomCursor` only mounts when `(pointer: fine)`. Magnetic effect degrades to a plain pill.
- **Focus** — every interactive element keeps `:focus-visible` ring (`--ring`). Don't suppress the outline on magnetic buttons.
- **Motion-triggered effects** like confetti use `useInView` so they don't fire on hidden tabs.

---

## 12. File Structure

```
src/
├── styles.css                    # tokens, @theme, keyframes, utilities
├── routes/
│   ├── __root.tsx                # font <link>, providers
│   ├── index.tsx                 # journey page (sections in reverse DOM order)
│   └── dashboard.tsx             # management surface
├── components/
│   ├── journey/
│   │   ├── NavHeader.tsx
│   │   ├── CustomCursor.tsx
│   │   ├── MagneticButton.tsx
│   │   ├── ResetFAB.tsx
│   │   ├── LotteryBall.tsx
│   │   ├── Trophy3D.tsx
│   │   ├── SectionDraft.tsx
│   │   ├── SectionRegular.tsx
│   │   ├── SectionPlayoffs.tsx
│   │   └── SectionChampionship.tsx
│   └── ui/                       # shadcn primitives (button, card, sonner, etc.)
└── lib/
    ├── mockData.ts               # Player, Sport, fixtures, feed, leaderboard
    └── utils.ts                  # cn()
```

**Dependencies that matter for this aesthetic:**
- `framer-motion` — all springs, scroll-linked transforms, layout animations.
- `@react-three/fiber` + `@react-three/drei` — trophy only. Don't add more 3D canvases; cost compounds.
- `react-confetti` — championship moment.
- `lucide-react` — icons.
- `sonner` — toasts (`Link copied!`, transfer confirmations).
- `tailwindcss v4` — CSS-first config in `styles.css`.

---

## 13. Adoption Checklist (porting to a new project)

1. Drop the full `:root` block and `@theme inline` map into your `src/styles.css`.
2. Load Inter (700–900) and DM Sans (400–700) via `<link>` in root head.
3. Copy the keyframes block verbatim.
4. Copy `.glass` / `.glass-strong` utilities.
5. Set `<body>` background to `#0A0A0F` and font-family to `var(--font-sans)`.
6. Lift `MagneticButton`, `CustomCursor`, `ResetFAB` as your interaction kit.
7. Pick a sport accent per section/page and theme buttons + shadows from it.
8. Reserve `gradient-champion` for the single "you won" moment — overuse kills it.
9. Audit every number on screen: does it have `.num`? If not, add it.
10. Test with `prefers-reduced-motion: reduce` enabled — the page should still tell the same story, just calmer.

---

*This document is the source of truth. If a component drifts from these specs, update either the component or this file — never both silently.*

# Sporty — "Broadcast" Design System (v2)

A complete spec for the **light, editorial, vibrant-block, premium-sports** aesthetic. Hand this file to any developer and they can reproduce the same look, feel, and motion without reading component source.

> **v2 replaces v1.** The previous system was a dark-matte, neon-glow, glassmorphism, soft-rounded "night stadium." v2 is its opposite: a **bright broadcast studio** — white canvas, ink slabs, a single red action color, oversized condensed uppercase type, sharp edges, hard-offset "poster" shadows, and ticker/scoreboard motion. Nothing about v2 should read as v1. See §14 for the old→new mapping.

Tokens live in `src/app/globals.css` (`:root` + `@theme inline`). Fonts load in `src/app/layout.tsx`.

---

## 1. Overview

**Purpose** — A multi-sport fantasy platform (Football, Basketball, Cricket, Rugby, Mix) for creating/joining leagues, drafting squads, setting lineups, and living the week-to-week scoreboard.

**Core philosophy**

- **Broadcast, not nightclub.** The base is a bright studio (`#F5F7FA`) with crisp white cards. This is TV-sports / sports-editorial energy (ESPN, DAZN, The Athletic, DraftKings), not a dark neon arcade.
- **Ink + one red.** Structure is drawn in near-black ink (`#0F172A`) — borders, dark slabs, headlines. **Red (`#DC2626`) is the only action color.** It means "do this / this is live / this is you." Never decorate with red.
- **Refined blocks, soft elevation.** Content sits in clean panels with hairline borders and **soft, layered shadows** — an elegant, premium editorial feel. Corners are gently rounded (8–14px). A **hard-offset "poster" shadow** (`5px 5px 0` ink) exists as a *rare, deliberate accent* (`.block-hard`), never the default.
- **Type is the graphic.** Barlow Condensed set BIG and UPPERCASE is the primary visual. Jersey-number stats, editorial kickers, scoreboard headlines.
- **Sport = data color, not theme.** Each sport has one saturated accent used as a **3px top stripe / tag / dot** for wayfinding. The page theme stays ink+red regardless of sport.
- **Tabular numbers everywhere.** Every score, rank, price, and countdown is `.num`.

---

## 2. Color Tokens

### Surfaces (light)
```css
--canvas:         #F5F7FA;   /* app background */
--surface:        #FFFFFF;   /* cards, panels */
--surface-muted:  #F1F5F9;   /* subtle fills, table zebra */
--surface-sunken: #E9EEF3;   /* insets, progress tracks */
--ink-block:      #0F172A;   /* dark editorial slab surface */
--ink-block-2:    #1E293B;
```

### Text
```css
--ink:        #0F172A;   /* headlines / primary text */
--ink-soft:   #334155;   /* secondary text */
--ink-muted:  #64748B;   /* captions / muted (AA floor on white) */
--ink-faint:  #94A3B8;   /* hints / disabled */
--on-ink:     #F8FAFC;   /* text on dark slabs */
```

### Action / brand — **red is the single action color**
```css
--primary:       #DC2626;
--primary-hover: #B91C1C;
--primary-press: #991B1B;
--primary-soft:  #FEE2E2;   /* tint bg */
--on-primary:    #FFFFFF;
--ring:          #DC2626;
```

### Lines
```css
--border:        #E2E8F0;   /* default card border */
--border-strong: #CBD5E1;   /* inputs, dividers */
--rule:          #0F172A;   /* hard editorial hairline */
```

### Sport accents — tuned for contrast on **white** (never the v1 neon set)
```css
--football:   #16A34A;   --football-soft:   #DCFCE7;
--basketball: #EA580C;   --basketball-soft: #FFEDD5;
--cricket:    #0891B2;   --cricket-soft:    #CFFAFE;
--rugby:      #7C3AED;   --rugby-soft:      #EDE9FE;
--playoff:    #9333EA;   --playoff-soft:    #F3E8FF;   /* mix / multi-sport */
--gold:       #CA8A04;   --gold-soft:       #FEF9C3;   /* champion */
```

### Semantic
```css
--success:#16A34A  --warning:#D97706  --danger:#DC2626  --info:#2563EB  --live:#DC2626
/* each has a *-soft tint for badge fills */
```

### Gradients — bold, energetic
```css
--gradient-action:   linear-gradient(135deg, #F43F5E, #DC2626);   /* CTAs, primary blocks */
--gradient-ink:      linear-gradient(135deg, #1E293B, #0F172A);   /* dark slabs */
--gradient-champion: linear-gradient(135deg, #FBBF24, #F97316 55%, #DC2626);  /* #1 / CHAMPION only */
--gradient-football / -basketball / -playoff / -pitch            /* sport washes */
```
**Reserve `--gradient-champion`** for the #1 rank, trophy halo, and the single "you won" headline. Overuse kills it.

### Rules of color
- **One red.** If two things are red, one of them is wrong. Sport accents carry the color variety.
- **Glow is gone.** No neon `box-shadow`. Emphasis comes from ink borders + hard-offset shadows.
- **Contrast floor:** body copy never lighter than `--ink-muted` (`#64748B`) on white. On ink slabs, never below `--on-ink-muted`.

---

## 3. Typography

```css
--font-display:   "Barlow Condensed";   /* headlines, stats, kickers */
--font-sans:      "Barlow";             /* body, labels, inputs */
--font-condensed: "Barlow Condensed";   /* alias for stat/label utilities */
```
Loaded via `next/font/google` in `layout.tsx` (`--ff-condensed`, `--ff-body`). Legacy classes `font-barlow-condensed`, `font-bebas`, `font-inter`, `font-dm-sans` are all shimmed to the real Barlow families, so existing markup renders correctly during migration.

| Role | Family | Weight | Case / Tracking | Utility |
|------|--------|--------|-----------------|---------|
| Hero / poster headline | Barlow Condensed | 700 | UPPERCASE, `-0.02em`, up to `12vw` | `.display` |
| Section title | Barlow Condensed | 700 | tight, `text-2xl`–`text-4xl` | heading tags |
| Kicker / eyebrow | Barlow Condensed | 700 | UPPERCASE `0.22em`, red, `text-xs` | `.kicker` |
| Card title / player name | Barlow Condensed | 600–700 | `text-base`–`text-lg` | — |
| Body | Barlow | 400–500 | normal, line-height 1.5 | default |
| Micro-label | Barlow Condensed | 600 | UPPERCASE `0.18em`, `text-[11px]` | `.micro-label` / `.section-label` |
| Stat / jersey number | Barlow Condensed | 700 | `tabular-nums`, oversized | `.stat-num` + `.num` |

Every number gets `.num` (`font-variant-numeric: tabular-nums`). Non-negotiable for the data-dense scoreboard feel.

---

## 4. Shape & Spacing

**Refined, gently rounded.** Corners are soft but restrained — premium, not playful.

| Token | Value | Use |
|-------|-------|-----|
| `--radius-xs` | 6px | tags, ticks |
| `--radius-sm` | 8px | buttons, inputs |
| `--radius-md` | 10px | small cards |
| `--radius-lg` | 14px | standard cards / panels / blocks |
| `--radius-xl` | 20px | hero / feature blocks |
| `--radius-2xl` | 28px | large hero surfaces |
| pill | `9999px` | **status pills, sport tags, LIVE badge only** |

| Layout | Value |
|--------|-------|
| Page max-width | `max-w-7xl` (dashboard), `max-w-6xl` (editorial/marketing) |
| Section padding | `px-4` mobile / `px-6`–`px-8` desktop, `py-16`–`py-24` |
| Block gap (marketing) | large — `gap-6` to `gap-12` (48px+ hero blocks) |
| Card padding | `p-4` (default), `p-3` (compact), `p-6` (feature) |
| Grid gap | `gap-3`–`gap-6` |
| Spacing rhythm | 4 / 8 system |

---

## 5. Elevation & Shadow

Soft, layered shadows are the default (premium depth). Hard-offset shadows are a **rare accent** only.

```css
--shadow-xs: 0 1px 2px rgba(11,18,32,.04);
--shadow-sm: 0 1px 2px rgba(11,18,32,.04), 0 2px 6px rgba(11,18,32,.05);    /* resting cards */
--shadow-md: 0 4px 8px -2px rgba(11,18,32,.05), 0 12px 24px -6px rgba(11,18,32,.09);   /* menus, popovers, sticky bars */
--shadow-lg: 0 12px 24px -8px rgba(11,18,32,.10), 0 28px 56px -14px rgba(11,18,32,.16); /* modals, toasts */
--shadow-xl: 0 24px 48px -12px rgba(11,18,32,.16), 0 48px 96px -24px rgba(11,18,32,.22); /* hero */

--shadow-hard:     5px 5px 0 0 var(--ink);      /* rare poster accent (.block-hard) */
--shadow-hard-sm:  3px 3px 0 0 var(--ink);
--shadow-hard-red: 5px 5px 0 0 var(--primary);
```
**Rule:** bulk cards use `--shadow-sm` + a hairline border, lifting to `--shadow-md/-lg` on hover (`.block`). Hard-offset shadows are reserved for the occasional deliberate poster moment — never the default.

---

## 6. Layout & Surface Utilities (the block language)

All defined in `globals.css`. Compose pages from these, don't reinvent.

| Class | What it is |
|-------|-----------|
| `.surface` / `.panel` | White card, 1px border, `--shadow-sm`, radius-md. The default container. |
| `.block` | **Signature block** — 2px ink border + `--shadow-hard-sm`; on hover lifts `translate(-2px,-2px)` to `--shadow-hard`. Use for interactive/feature cards. |
| `.block-red` | `.block` variant with red border + red hard shadow. Primary emphasis. |
| `.ink-panel` | Dark slab (`--ink-block` bg, `--on-ink` text). Headers, hero strips, stat banners. |
| `.accent-bar` + `.accent-{sport}` | 3px top stripe coloring a card by sport / primary. |
| `.rule` / `.hairline` | 2px ink divider / 1px border divider (editorial section breaks). |
| `.kicker` | Red uppercase eyebrow opening a section. |
| `.diagonal` / `.diagonal-tr` | Clip-path chevron cut — kinetic sport edge. |
| `.glass` / `.glass-strong` | **Light** frost for sticky bars / modals over content (72–86% white + blur). Not for full-bleed backgrounds. |
| `.field-lines` / `.dot-grid` | Subtle pitch-grid / dotted background washes. |

**Composition pattern — editorial section:**
```
<section>
  <div class="kicker">STANDINGS</div>          ← red eyebrow
  <h2>Premier League</h2>                        ← condensed uppercase title
  <hr class="rule" />                            ← hard rule
  <div class="grid gap-4"> …blocks… </div>
</section>
```

---

## 7. Motion — kinetic-athletic register

Motion is broadcast graphics, not neon flicker. Timing 150–300ms, `--ease` / `--ease-out`. Framer Motion for springs; CSS for ambient.

| Class | Effect | Where |
|-------|--------|-------|
| `.ticker-track` | Horizontal marquee (32s loop, pause on hover) | Live-score / news ticker strips |
| `.clip-reveal` | Edge wipe (`inset(0 100% 0 0)` → in) | Scoreboard rows, stat reveals |
| `.float-up` / `.animate-fade-in` | `translateY(14px)` + fade | Section / card entrance |
| `.animate-slide-in-left` | Slide from left | List items, drawer content |
| `.animate-fade-in-scale` | `scale(0.97)` + fade | Modals, toasts, popovers |
| `.animate-live-pulse` / `.pill-live` | Opacity pulse + red dot | LIVE labels |
| `.shimmer` | Light skeleton shimmer | Loading placeholders |

Framer springs (component-level): card snap `stiffness 220 / damping 22`; press feedback subtle `scale(0.98)` via CSS on `button:active`. Reserve confetti for the single championship moment.

**Signature moves:** the **ticker** (live scores scrolling across an ink strip), the **clip-reveal** on scoreboard/stat rows, and the **hard-shadow lift** on `.block` hover. These three carry the identity.

All ambient animation is disabled under `prefers-reduced-motion: reduce` (handled globally in `globals.css`).

---

## 8. Accessibility

- **Contrast** — body text ≥ `--ink-muted` on white (AA). On ink slabs use `--on-ink` / `--on-ink-muted`. Red on white (`#DC2626`) passes AA for text and UI.
- **Color is never the only signal** — sport accents always pair with a text label; LIVE pairs the red dot with the word "LIVE"; +/- deltas pair color with a sign/arrow.
- **Focus** — every interactive element keeps the 2px red `:focus-visible` ring. Never suppressed.
- **Touch** — targets ≥ 44px; bottom nav ≤ 5 items.
- **Motion** — all keyframe decoration respects reduced-motion.
- **Numbers** — tabular figures prevent layout shift on live-updating scores.

---

## 9. Component Catalog

### Buttons (`components/ui/Button.tsx`)
Sharp `radius-sm`, Barlow Condensed 600 UPPERCASE, `tracking-[0.06em]`.
- **primary** — solid `--primary`, white text; hover `--primary-hover`; feature CTAs may add `--shadow-hard-red` + hover lift.
- **secondary** — solid ink (`--ink`), white text.
- **outline** — transparent, 1.5px `--border-strong`, ink text; hover ink border.
- **ghost** — transparent, ink-muted text; hover `--surface-muted`.
- **danger** — same as primary (red is already danger); reserve for destructive with an icon + confirm.
Sizes: `sm` `px-3 py-1.5 text-xs` · `md` `px-5 py-2.5 text-sm` · `lg` `px-6 py-3 text-base`.

### Card (`components/ui/Card.tsx`)
White, 1px `--border`, `radius-md`, `--shadow-sm`. `CardTitle` = Barlow Condensed 700 uppercase. Add `.accent-{sport}` for a sport stripe, or swap to `.block` for interactive emphasis.

### Input (`components/ui/Input.tsx`)
White bg, 1.5px `--border-strong`, `radius-sm`, ink text, `--ink-faint` placeholder; focus → red border + red ring. Visible label above (never placeholder-only); error text `--danger` below.

### Ink Panel / Scoreboard header
`.ink-panel` slab: kicker + big condensed title in `--on-ink`, right-aligned stat in `.stat-num`. Used for page headers, gameweek banners, match scoreboards.

### Stat Block
`.block` or `.surface` with `.accent-{sport}`: giant `.stat-num` (`text-4xl`–`text-6xl`) on top, `.micro-label` beneath. Optional delta pill.

### Standings / Leaderboard table
Full-width `.surface`. Header row = `.ink-panel` or ink text on `--surface-muted`. Zebra via `--surface-muted`. Bold rank column; `#1` uses `.rank-1` champion gradient; the "you" row gets `--primary-soft` bg + red left-border. Sortable headers show `aria-sort`.

### Player card
`.block`, sport `.accent-bar`. Left: gradient/initial avatar (radius-sm, **not** circular — jersey-tile feel). Name (Condensed 700), position `.micro-label`, price `.num`. Status dot: fit `--success` / doubt `--warning` / out `--danger`, each with label. Right: points in `.stat-num`.

### Badges / Pills
`.pill` (uppercase condensed) for status; `.sport-badge-{sport}` soft-tint tags; `.pill-live` for LIVE. Sharp small radius except status pills (full).

### Nav shell
- **Desktop:** left `.surface` sidebar OR top bar. Brand mark (ink + red), uppercase condensed nav labels, active item = ink text + 3px red left/bottom indicator + `--surface-muted` fill.
- **Mobile:** bottom nav ≤ 5 items, icon + label, active = red.
Sticky headers use `.glass-strong`.

### Ticker
Ink strip (`.ink-panel`) full-bleed, `.ticker-track` scrolling score chips (team · score · `.pill-live`). Pauses on hover. The signature broadcast element.

### Empty states & skeletons
Empty: centered ink icon in a `--surface-muted` tile, condensed uppercase title, muted body, one primary CTA. Skeletons use `.shimmer` on `--surface-muted` blocks.

---

## 10. Signature Recipes (copy-paste)

**Hard-shadow feature block**
```html
<div class="block block-red rounded-sm p-6">
  <div class="kicker">GAMEWEEK 12</div>
  <div class="stat-num num text-5xl mt-2">1,204</div>
  <div class="micro-label mt-1">total points</div>
</div>
```

**Broadcast ticker**
```html
<div class="ink-panel overflow-hidden">
  <div class="ticker-track">
    <!-- duplicate the chip list twice for a seamless -50% loop -->
    <span class="px-4 py-2 num">ARS 2 – 1 CHE</span> …
  </div>
</div>
```

**Editorial section head**
```html
<div class="kicker">MY LEAGUES</div>
<h2 class="text-3xl">This Season</h2>
<hr class="rule my-4" />
```

**Scoreboard row reveal** — add `.clip-reveal` (stagger with `animation-delay` per row).

---

## 11. Sport Theming

The **page** is ink+red always. Sport identity is applied locally as a data color:
```ts
const sport = {
  football:   { accent: "accent-football",   badge: "sport-badge-football",   grad: "gradient-football"   },
  basketball: { accent: "accent-basketball", badge: "sport-badge-basketball", grad: "gradient-basketball" },
  cricket:    { accent: "accent-cricket",    badge: "sport-badge-cricket",    grad: "gradient-cricket"    },
  rugby:      { accent: "accent-rugby",      badge: "sport-badge-rugby",      grad: "gradient-playoff"    },
  mix:        { accent: "accent-playoff",    badge: "sport-badge-multisport", grad: "gradient-playoff"    },
};
```
Use `accent` for the card top-stripe, `badge` for the tag, `grad` for avatars / small fills. Do **not** repaint the whole page per sport.

---

## 12. File Structure

```
src/
├── app/
│   ├── globals.css        # tokens, @theme, utilities, keyframes  ← this system
│   ├── layout.tsx         # Barlow + Barlow Condensed fonts, providers
│   └── (auth|public|dashboard)/…
├── components/
│   ├── ui/                # Button, Card, Input, badges, empty-states, skeletons
│   ├── dashboard/navigation/  # Sidebar, MobileBottomNav, header, NotificationBell
│   ├── landing/ · live/ · public-matches/
│   └── …
└── features/              # feature modules (compose ui + hooks)
```

**Dependencies that matter for this aesthetic:** `framer-motion` (springs, reveals), `lucide-react` (icons — one family, ~1.75px stroke), `react-confetti` (championship only), `@mantine/core` (behavioral primitives, restyled to tokens), `tailwindcss v4` (CSS-first config in `globals.css`).

---

## 13. Adoption Checklist (per component during Phases 1–9)

1. Delete hardcoded dark hex (`#0a0a0f`, `#111117`, `#f0f0f0`, `#e8fb25`, `text-white/70`, `bg-black`) → light tokens.
2. Container → `.surface` / `.block` / `.ink-panel`. Corners sharp (radius-sm/md).
3. Emphasis → ink border + hard-offset shadow, **not** glow.
4. Headings → Barlow Condensed uppercase; open sections with a `.kicker` + `.rule`.
5. One red for actions; sport color only as stripe/tag/dot.
6. Every number → `.num`; big stats → `.stat-num`.
7. Verify contrast on white (AA); keep the red focus ring.
8. Test `prefers-reduced-motion` and 375 / 768 / 1024 / 1440.
9. When a component is fully migrated, drop its legacy shim block from `globals.css`.

---

## 14. What changed from v1 (old → new)

| Dimension | v1 "Night Stadium" | v2 "Broadcast" |
|-----------|--------------------|----------------|
| Canvas | `#0A0A0F` matte black | `#F5F7FA` bright studio |
| Surfaces | Frosted **glass** over parallax | Solid **white blocks** + 1px border |
| Accent | Neon green / orange / purple (glow) | **One red** action color + sport data-colors |
| Emphasis | Neon `box-shadow` glow | **Hard-offset poster shadow** + ink border |
| Shape | Soft `0.875rem` rounded | **Sharp** 2–6px edges |
| Type | Inter + DM Sans | **Barlow Condensed + Barlow** (condensed uppercase) |
| Motion | Glitch / flicker / lightning | **Ticker / clip-reveal / shadow-lift** |
| Mood | Dark arcade, immersive scroll-journey | Bright sports-editorial / broadcast studio |

---

*This document is the source of truth. If a component drifts from these specs, update either the component or this file — never both silently.*

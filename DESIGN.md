---
version: alpha
name: Precision Diagnosis
description: Paper-and-ink diagnostic report aesthetic for claude-checkup (claudecowork.co.kr) — a Korean-language Claude Code skill catalog and self-assessment tool.
colors:
  primary: "#b8500f"
  secondary: "#23201b"
  tertiary: "#3f7d4e"
  neutral: "#f6f5f1"
  paper: "#f6f5f1"
  paper-2: "#efece4"
  line: "#dcd7cb"
  line-strong: "#c6bfae"
  ink: "#23201b"
  ink-soft: "#5c574d"
  ink-faint: "#6a6557"
  accent: "#e8702a"
  accent-ink: "#b8500f"
  accent-deep: "#8a3d0b"
  field: "#ffffff"
  verdict-good: "#376d45"
  verdict-good-bg: "#e6efe6"
  verdict-gap-ink: "#8a3d0b"
  verdict-gap: "#e8702a"
  verdict-gap-bg: "#f7e6d8"
  verdict-skip-bg: "#ebe8e0"
typography:
  hero:
    fontFamily: Fraunces
    fontSize: 48px
    fontWeight: "900"
    lineHeight: 1.1
    letterSpacing: -0.02em
  title:
    fontFamily: Fraunces
    fontSize: 30px
    fontWeight: "700"
    lineHeight: 1.25
  heading:
    fontFamily: Fraunces
    fontSize: 20px
    fontWeight: "700"
    lineHeight: 1.35
  body:
    fontFamily: Pretendard
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 1.7
  small:
    fontFamily: Pretendard
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.6
  caption:
    fontFamily: Pretendard
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 1.5
  code:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 1.6
rounded:
  sm: 2px
  DEFAULT: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  unit: 4px
  section: 64px
  card-padding: 20px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
components:
  button-primary:
    backgroundColor: "{colors.accent-ink}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    typography: "{typography.small}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
  card-meta:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-faint}"
    typography: "{typography.code}"
    rounded: "{rounded.sm}"
  input-search:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  install-command:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.code}"
    rounded: "{rounded.md}"
  badge-verified:
    backgroundColor: "{colors.verdict-good-bg}"
    textColor: "{colors.verdict-good}"
    rounded: "{rounded.full}"
    typography: "{typography.caption}"
  badge-gap:
    backgroundColor: "{colors.verdict-gap-bg}"
    textColor: "{colors.verdict-gap-ink}"
    rounded: "{rounded.full}"
    typography: "{typography.caption}"
  badge-skip:
    backgroundColor: "{colors.verdict-skip-bg}"
    textColor: "{colors.ink-faint}"
    rounded: "{rounded.full}"
    typography: "{typography.caption}"
  stamp-verdict:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.hero}"
    rounded: "{rounded.full}"
---

## Overview

A **printed diagnostic report**, not a dashboard. The product tells a Korean developer
which Claude Code skills they already use well, which they are missing, and which they
can skip — so the interface borrows from medical charts, lab results, and official
paperwork: warm paper stock, ruled lines, ink-stamped verdicts.

The deliberate opposite of a generic AI-tool landing page. No purple gradients, no
Inter-on-slate, no glassmorphism, no dark-by-default. Light mode is the primary
identity; dark mode is a separate "night reading room" treatment, not an inversion.

## Colors

The palette is **warm paper and ink**, with a single earned accent.

- **Paper (#f6f5f1):** Cream page stock. Never pure white — pure white reads as "web app",
  cream reads as "document".
- **Paper-2 (#efece4):** Slightly heavier stock for cards and grouped sections.
- **Line (#dcd7cb) / Line-strong (#c6bfae):** Ruled lines. Structure comes from rules and
  tonal shifts, not from shadows.
- **Ink (#23201b):** Body text — soft black, never #000. Ink-soft (#5c574d) for secondary,
  ink-faint (#8b8577) for metadata.
- **Accent (#e8702a):** Orange, used for the rubber-stamp verdict, highlights, and chips.
- **Accent-ink (#b8500f):** The *only* value allowed as a button background. It measures
  5.0:1 against white text (WCAG AA). The brighter #e8702a fails at 2.9:1 and must never
  carry white text — this exact mistake shipped once and had to be corrected.

Verdict colors are semantic, not decorative, and are bound to score logic:
green = "already using well", orange = "gap to close", gray = "not needed".

## Typography

Three typefaces, each with a job:

- **Fraunces** (display serif) for hero, titles, and headings. Its high-contrast,
  slightly wonky letterforms give the report an editorial, printed authority that a
  geometric sans cannot. **Noto Serif KR** pairs with it for Korean headings.
- **Pretendard** (sans) for all body copy and UI. Chosen specifically because it renders
  Hangul with even rhythm at small sizes — the majority of this product's text is Korean.
- **Space Mono** for install commands, skill names, and code. The typewriter feel
  reinforces "this is a record, not marketing copy".

Sizes above are the **desktop snap values**. In implementation each display size is a
`clamp()` that reaches exactly this value at its breakpoint and shrinks fluidly below
(hero 48px desktop → 36px at 375px). Body sizes are fixed. Line height for Korean body
copy is generous (1.7) — Hangul needs more vertical air than Latin at the same size.

## Layout & Spacing

A 4px baseline. Sections are separated by `spacing.section` (64px desktop, fluid down to
56px on mobile) — the rhythm of page breaks in a document, not uniform padding.

Content is centered in a readable measure. The catalog uses a count-bearing sidebar on
desktop and a filter sheet on mobile; both are driven by the same computed counts, never
hardcoded numbers. Mobile margins tighten but interactive targets stay at 44px minimum.

## Elevation & Depth

Depth comes from **offset print shadows**, not blur. A card sits on the page with a hard
2–3px offset in `line-strong` — like a stacked sheet of paper, or a stamp impression.
There is no ambient glow and no backdrop blur anywhere in the product.

In dark mode the same offset switches to pure black, because the shadow must be darker
than the night-paper surface to read as lift. This is the one token whose *value* must
differ by theme rather than merely shifting hue.

## Shapes

Restrained radii. `rounded-md` (6px) is the workhorse and appears on nearly every
surface; `rounded-lg` (8px) on cards; `rounded-full` reserved for verdict badges and
status pills so they are never confused with buttons. Nothing is fully squared and
nothing is pill-shaped unless it is a status.

## Components

### Buttons
Primary is solid `accent-ink` with white text, a `accent-deep` border, and a hard offset
shadow that collapses on press — a physical stamp being pushed down. Secondary is
transparent with an ink border.

### Cards (skill entries)
Paper surface, ruled border, offset shadow. Each card carries a **trust tier badge**
(verified / marketplace / unverified) and an install command in mono. A card must never
imply an install path that has not been verified — an unknown install renders as absent,
not as a plausible guess.

### The Stamp
Verdict results appear as a rotated rubber stamp that lands with an overshoot animation
(~380ms, transform and opacity only, fully disabled under `prefers-reduced-motion`).
This is the product's signature moment and should survive any redesign.

### Search
The search field is the primary call to action on the catalog, on a pure-white fill so it
lifts off the cream page. Autocomplete is a combobox rendered client-side with no network
request per keystroke.

### Lists and tables
Rows separated by 1px `line` rules with generous vertical padding. Tables read as
lab-result sheets: left-aligned labels, right-aligned figures, mono for numerals.

## Dark Mode

Dark mode is a **night reading room**, not an inverted document: night-paper #201c16
surfaces, warm ink #ece5d6 at 13.5:1, and a brighter orange #f2874c that carries *dark*
text rather than white. Both themes must feel deliberately designed; neither is a
fallback for the other.

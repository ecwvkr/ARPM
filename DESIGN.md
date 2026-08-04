---
name: AR_PM
description: A quiet, ledger-like task tool for a small trusted team — one accent color, hairline dividers, and a task-derivation tree as the star.
colors:
  ledger-blue: "#2563eb"
  paper: "#ffffff"
  ink: "#0a0a0a"
  fog: "#f5f5f5"
  fog-ink: "#171717"
  ash: "#737373"
  hairline: "#e5e5e5"
  alert-red: "#e7000b"
  priority-urgent: "#ef4444"
  priority-high: "#f97316"
  priority-normal: "#d4d4d8"
  priority-low: "#e4e4e7"
typography:
  body:
    fontFamily: "system-ui sans-serif (OS default — see Typography note)"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.5"
  title:
    fontFamily: "system-ui sans-serif (OS default)"
    fontSize: "16-18px"
    fontWeight: 500
    lineHeight: "1.3"
  label:
    fontFamily: "system-ui sans-serif (OS default)"
    fontSize: "12-13px"
    fontWeight: 500
    lineHeight: "1.2"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ledger-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.ledger-blue}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  badge-status-open:
    backgroundColor: "{colors.ledger-blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
    height: "20px"
  badge-status-done:
    backgroundColor: "{colors.fog}"
    textColor: "{colors.fog-ink}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
    height: "20px"
  badge-overdue:
    backgroundColor: "{colors.alert-red}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
    height: "20px"
---

# Design System: AR_PM

## Overview

**Creative North Star: "The Team Ledger"**

AR_PM is built for a small trusted team, not a public audience — the visual system behaves like a shared ledger, not a marketing surface. It stays out of the way of the work: one accent color, quiet neutrals, hairline dividers instead of shadows, and Korean sentence-style labels rather than shouty all-caps UI chrome. Nothing competes with the thing the product actually exists to show — the task-derivation tree — so every persistent surface (project cards, task cards, status groups) is flat and understated, and elevation is spent only where something is genuinely floating above the page (a dialog, a sheet, a popover).

The system currently expresses exactly one point of color — Ledger Blue — for anything "open" or actionable; red is reserved exclusively for urgency (지연/overdue); everything else is graphite-on-white. This is a deliberate, confirmed constraint, not an oversight: the team explicitly wants this to stay minimal and neutral, with room to let end users pick their own accent color later (see Do's and Don'ts).

**Key Characteristics:**
- One accent color carries all "active" meaning; red is reserved for urgency alone.
- Hairline (0.5px) borders and filled-neutral surfaces do the depth work at rest; real shadows appear only on floating overlays (Dialog/Sheet/Popover).
- Pill-shaped badges and pill-shaped primary actions (the "+" add button) recur as a soft, rounded accent against otherwise squared-corner cards.
- Sentence-style Korean copy throughout; no label-case, minimal bold.

## Colors

Deliberately near-monochrome: one blue does all the "this matters / this is active" signaling; a red is carved out exclusively for urgency; everything else is a tight white-to-graphite neutral ramp.

### Primary
- **Ledger Blue** (`#2563eb` / `oklch(0.546 0.215 262.88)`): the one accent color in the system. Used for the primary button fill, active/open status badges (진행전 + 진행중 both read as "open" and share this color — see the Two-State Signal rule below), links-as-actions, focus rings, and the app's theme-color / PWA icon tint. Nothing else in the UI competes with it.

### Neutral
- **Paper** (`#ffffff`): base background and card surface.
- **Ink** (`#0a0a0a`): primary text.
- **Fog** (`#f5f5f5`): secondary/muted surface fill — used for "closed" status badges, the project-card background block, and hover fills.
- **Fog Ink** (`#171717`): text on Fog surfaces.
- **Ash** (`#737373`): muted/secondary text (timestamps, counts, helper copy).
- **Hairline** (`#e5e5e5`): the literal border color for every 0.5px divider in the system.

### Alert (functional, not decorative)
- **Alert Red** (`#e7000b` / `oklch(0.577 0.245 27.325)`): exclusively for the "지연" (overdue) badge. Never used for anything else — it is a single-purpose urgency signal, not a general destructive-action color (destructive buttons use a *tinted* 10%-opacity red fill, not this solid tone).

### Priority Dots (participant-level, separate from status color)
- **Urgent** (`#ef4444`), **High** (`#f97316`), **Normal** (`#d4d4d8`), **Low** (`#e4e4e7`) — small solid dots, not badges, shown per-participant on in-progress task cards. This is the only place the system uses more than two hues at once, and it's deliberately desaturated at the low end so only genuine urgency reads as "hot."

### Named Rules
**The One Accent Rule.** Ledger Blue is the only color that means "this is active / do something here." Everything else is either neutral (structure) or the single reserved red (urgency). Do not introduce a second brand hue for emphasis — reach for weight, size, or the existing red before adding color.

**The Two-State Signal Rule.** Status badges only ever show two visual states: *open* (Ledger Blue — covers both 진행전 and 진행중, they are not visually distinguished from each other) and *closed* (Fog gray — 종료). Urgency is layered on separately via the standalone red 지연 badge; the status badge itself never turns red or green.

## Typography

**Body/Display/Label Font:** system-default sans-serif (OS UI font — observed as "Noto Sans KR" on this session's platform; renders as Apple SD Gothic Neo / Malgun Gothic / Segoe UI equivalents depending on the visitor's OS).

**Character:** plain and quiet — sentence-style Korean labels, medium weight for emphasis instead of bold, no display/heading face distinct from body.

> **Note on Geist.** `next/font` loads Geist Sans/Mono into `--font-geist-sans` / `--font-geist-mono` in `app/layout.tsx`, but `app/globals.css`'s `@theme inline` block maps the Tailwind `font-sans` token to `var(--font-sans)` — a variable that is never actually set to `--font-geist-sans`. As a result Geist is downloaded but never rendered; every visible character currently falls back to the browser/OS default sans stack. This is a real gap worth fixing (one line in `globals.css`), not a documented design decision — flagging it here rather than silently treating "system default" as the intended typeface.

### Hierarchy
- **Title** (medium/500, 16-18px, tight line-height): page headers, project/task names, dialog titles.
- **Body** (regular/400, 14px, 1.5 line-height): default UI text, memos, comments.
- **Label** (medium/500, 12-13px): badges, meta rows (master명, 참여자 수, 코멘트 수, 날짜), nav labels.

### Named Rules
**The No-Display-Face Rule.** There is no distinct display/hero typeface anywhere in the system — even the dashboard's largest numerals (summary card counts) are the same face at a larger size/weight, not a different font. Consistent with the "ledger, not marketing page" north star.

## Layout

Responsive, card-grid based: phone ~2 columns, tablet ~3 columns, desktop 4 columns (dashboard/task grids use `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`). Desktop additionally offers a manual container-width toggle (넓게/패드/폰 — `max-w-none` / `max-w-3xl` / `max-w-sm`), persisted to `localStorage`, so a wide monitor can be voluntarily narrowed to a tablet- or phone-width reading column instead of stretching content edge to edge.

Page chrome is a fixed top header (title + context actions) and, when authenticated, a fixed bottom navigation bar on all viewport sizes (`app/layout.tsx` adds `pb-16` to the body to clear it). Content between them scrolls; the header and bottom nav do not.

Card grids use consistent gaps (`gap-3`/`gap-4`), and every card-style container shares one internal padding scale (`p-4`), so density reads as uniform across project cards, task cards, and summary cards regardless of their differing corner radii.

## Elevation & Depth

Flat by default. Persistent surfaces (project cards, task cards, summary cards, headers, the bottom nav) never use `box-shadow` — depth comes from either a 0.5px hairline border (`border-[0.5px]`, color Hairline `#e5e5e5`) against the Paper background, or a filled Fog-gray block with no border at all (project cards specifically: no border, just a flat gray fill against the white page). Real elevation — an actual `box-shadow` — is reserved for content that is genuinely floating above the page: the shadcn Dialog/Sheet/Popover primitives (a subtle `ring-1 ring-foreground/10`, ~14px radius, plus a real `shadow-lg` on the Sheet drawer) and the React Flow canvas node cards, which get a light `shadow-sm` specifically so a node reads as "sitting above" the graph's dot-grid background.

### Shadow Vocabulary
- **Overlay ring** (`box-shadow: 0 0 0 1px oklch(0.145 0 0 / 0.1)`, ~14px radius): Dialog and Popover content.
- **Drawer shadow** (`shadow-lg`): Sheet (task-detail drawer, canvas node detail).
- **Canvas-lift** (`shadow-sm`): React Flow task nodes only — the one exception to flat-by-default, used because the node must visually separate from the graph's background grid.

### Named Rules
**The Hairline-Not-Shadow Rule.** Any surface that is part of the page's permanent layout gets a 0.5px hairline border or a flat fill — never a shadow. A shadow appearing on a resting (non-floating) element is a bug, not a style choice.

## Shapes

Two corner families in active use, both derived from one base radius (`--radius: 0.625rem` / 10px, scaled by CSS `calc()`):
- **14px (`rounded-xl`)** — the default "card" corner: task cards, dialogs, kanban columns, canvas nodes.
- **18px (`rounded-2xl`)** — a slightly softer corner reserved for the dashboard's top-level surfaces: project cards and the summary stat cards, making them read as one level "friendlier" than the task-level cards nested inside a project.
- **10px (`rounded-lg`)** — buttons, inputs, native `<select>` fields (all form controls share this radius).
- **Fully round (`rounded-full` / pill)** — badges, the primary "+" add-project button, and the circular "AR" logo mark in the header.

Borders are hairline-weight (`0.5px`, not the browser's default `1px`) everywhere they appear on resting content, which is what keeps the flat surfaces from feeling stark white-on-white without introducing any shadow.

## Components

### Buttons
- **Shape:** 10px radius (`rounded-lg`), 32px height at default size.
- **Primary:** Ledger Blue fill, white text, hover dims to 80% opacity (no color shift, no shadow).
- **Outline:** transparent/white fill, Hairline border, hover fills to Fog gray.
- **Destructive:** *tinted* red (`bg-destructive/10`, red text) — not the solid Alert Red used for the overdue badge; deliberately a quieter register since destructive actions here (task/project deletion) already require typing a confirmation word, so the button itself doesn't need to shout.
- **Ghost / Secondary / Link:** no fill at rest; ghost hovers to Fog gray, link is Ledger-Blue underlined text.

### Badges
- **Style:** pill-shaped (`rounded-full`), 20px tall, 12px label text, no border by default.
- **Status:** two states only — open (Ledger Blue fill) / closed (Fog fill) — per the Two-State Signal rule.
- **Overdue:** solid Alert Red fill, always shown alongside (never instead of) the status badge.
- **Visibility:** 공개 (public) = Fog-filled secondary badge; 비공개 (private) = outlined badge with a Hairline border and Ink text — the one badge variant that's outlined instead of filled, signaling "this one needs attention to who can see it."

### Cards / Containers
- **Task Card** — 14px radius, Paper background, 0.5px Hairline border, `p-4` padding. Title + status/overdue badges up top, then a compact muted-text meta stack (master, participant/comment counts, due date), then optional tag chips and per-participant priority dots at the bottom.
- **Project Card** — 18px radius, flat Fog-gray fill (no border), `aspect-4/3`. The one card style that trades the hairline-border language for a solid neutral block — it's the top-level entry point into a project, so it gets slightly more visual weight than the cards nested inside it.
- **Summary/Stat Card** — 18px radius, Paper background, 0.5px Hairline border, centered text; a large bold number over a small muted label.

### Inputs / Fields
- **Style:** 10px radius, Hairline border, transparent background, 32px height, 14px text.
- **Focus:** border shifts to Ledger Blue (`focus-visible:border-ring`) with a soft 3px Ledger-Blue-at-50%-opacity ring around it — no glow, no shadow.
- **Disabled:** 50% opacity, border unchanged.
- **Native `<select>` elements** (not a custom dropdown component) share this exact visual language rather than a distinct control style.

### Navigation
- **Top header:** fixed, Paper background, 0.5px Hairline bottom border only (no shadow); left side is context (back link + title), right side is actions (bell, logout, admin controls).
- **Bottom Navigation** (signature component, mobile and desktop alike): fixed to the viewport bottom, Paper background, 0.5px Hairline top border, five equal-width items (icon + 12px label). Active item is Ink-colored + medium weight; inactive items are Ash-colored; not-yet-built items (캘린더/캔버스/설정 currently) render at 40%-opacity Ash with a `cursor-not-allowed` and a "준비 중입니다" tooltip rather than being hidden — the nav's full future shape is always visible, even before every tab works.

## Do's and Don'ts

### Do:
- **Do** keep every persistent surface flat (hairline border or flat neutral fill) and save real `box-shadow` for Dialog/Sheet/Popover/canvas-node overlays only.
- **Do** use Ledger Blue for exactly one meaning — "open / active / do this" — and reach for weight or the reserved red before adding a second hue.
- **Do** keep destructive actions in the quieter tinted-red register, not solid Alert Red; solid red is reserved for the 지연 (overdue) signal alone.
- **Do** use 0.5px borders, not the browser default 1px, on every hairline divider.
- **Do** keep labels sentence-style Korean; avoid label-case/all-caps chrome.

### Don't:
- **Don't** add a second brand accent color without deliberate confirmation — the team has explicitly flagged this as a future user-configurable setting (a point-color picker in Settings), not something to freelance today. Until that setting exists, `#2563eb` stays the one hardcoded accent.
- **Don't** give 진행전 and 진행중 different status-badge colors — they intentionally share the "open" blue; only the separate overdue badge should ever turn red.
- **Don't** introduce a shadow on a resting card, header, or nav bar — that visual weight is reserved for things that are actually floating above the page.
- **Don't** assume Geist is what's rendering the type — until the `--font-sans` wiring gap above is fixed, every face on screen is the visitor's OS default sans, not Geist.

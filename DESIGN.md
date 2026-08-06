---
name: AR_PM
description: A bold, tactile "command board" for a small trusted team — monochrome black accent, soft-lifted cards, Tabler iconography.
colors:
  console-black: "#171717"
  paper: "#ffffff"
  ink: "#0a0a0a"
  fog: "#f5f5f5"
  ash: "#737373"
  hairline: "#e5e5e5"
  focus-steel: "#a1a1a1"
  alert-red: "#e7000b"
  priority-urgent: "#ef4444"
  priority-high: "#f97316"
  priority-normal: "#d4d4d8"
  priority-low: "#e4e4e7"
typography:
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.5"
  title:
    fontFamily: "Inter, ... (see body — same stack)"
    fontSize: "16-18px"
    fontWeight: 500
    lineHeight: "1.3"
  label:
    fontFamily: "Inter, ... (see body — same stack)"
    fontSize: "12-13px"
    fontWeight: 500
    lineHeight: "1.2"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  3xl: "22px"
  4xl: "26px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.console-black}"
    textColor: "{colors.paper}"
    rounded: "{rounded.4xl}"
    padding: "0 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.console-black}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.4xl}"
    padding: "0 12px"
    height: "36px"
  badge-status-open:
    backgroundColor: "{colors.console-black}"
    textColor: "{colors.paper}"
    rounded: "{rounded.3xl}"
    padding: "2px 8px"
    height: "20px"
  badge-status-done:
    backgroundColor: "{colors.fog}"
    textColor: "{colors.console-black}"
    rounded: "{rounded.3xl}"
    padding: "2px 8px"
    height: "20px"
  badge-overdue:
    backgroundColor: "{colors.alert-red}"
    textColor: "{colors.paper}"
    rounded: "{rounded.3xl}"
    padding: "2px 8px"
    height: "20px"
---

# Design System: AR_PM

## Overview

**Creative North Star: "The Command Board"**

AR_PM reads less like a quiet ledger now and more like a control surface a team actually commands from: bold, tactile, confident. There is no colored brand hue anywhere in the system — the "accent" is simply the darkest point of one continuous black-to-white neutral ramp, so buttons, active status badges, and the logo mark are pure near-black rather than a tinted brand color. Containers — cards, dialogs, popovers, the task-detail sheet — now genuinely float: they carry real, soft shadows and generous rounding (22-26px), a deliberate move away from the earlier flat/hairline treatment. Controls — buttons, inputs, badges, checkboxes — stay flat and filled rather than shadowed, so the floating/flat distinction still tracks which components are "surfaces" versus "instruments" within them.

Red is still the one true hue reserved exclusively for urgency (지연/overdue). Individual users can opt into a personal accent hue via Settings (a single custom color override on top of the monochrome default) — that capability is unchanged from before and remains the one sanctioned way color enters the system.

**Key Characteristics:**
- No brand hue at rest — the primary "accent" is the black end of the neutral scale, not a separate color.
- Containers float (soft shadow + 22-26px rounding); controls stay flat and filled.
- Red is reserved exclusively for the overdue signal; users may opt into a personal accent color in Settings.
- Tabler iconography throughout (no more mixed icon libraries).
- Korean-safe typography: Inter carries Latin/numeral text, falling through cleanly to the OS's own Korean UI font for Hangul.

## Colors

Effectively monochrome at rest: one neutral ramp from white to near-black carries every structural and "active" meaning; red is carved out exclusively for urgency; a personal accent hue is available only as an explicit per-user opt-in.

### Primary
- **Console Black** (`#171717` / `oklch(0.205 0 0)`): the system's only "accent," and it isn't a hue — it's the darkest step of the neutral ramp. Used for the primary button fill, open/active status badges (진행전 + 진행중 share this — see the Two-State Signal rule), the header's "AR" logo mark, and links-as-actions. Users may override this per-account with a real color from Settings; until they do, it stays black.

### Neutral
- **Paper** (`#ffffff`): base background and card surface.
- **Ink** (`#0a0a0a`): primary text.
- **Fog** (`#f5f5f5`): secondary/muted fill — "closed" status badges, the project-card background block, filled input backgrounds.
- **Ash** (`#737373`): muted/secondary text (timestamps, counts, helper copy).
- **Hairline** (`#e5e5e5`): the border/divider color wherever a border still appears (mostly outside the shadcn primitives now — see Do's and Don'ts).
- **Focus Steel** (`#a1a1a1`): the default focus-ring color when no personal accent is set — neutral, not tinted, unlike the earlier accent-colored ring.

### Alert (functional, not decorative)
- **Alert Red** (`#e7000b` / `oklch(0.577 0.245 27.325)`): exclusively the "지연" (overdue) badge. Destructive buttons use a quieter *tinted* red fill, never this solid tone — solid red stays a single-purpose urgency signal.

### Priority Dots (unchanged, participant-level)
- **Urgent** (`#ef4444`), **High** (`#f97316`), **Normal** (`#d4d4d8`), **Low** (`#e4e4e7`) — small solid dots per participant on in-progress task cards. Still the only place in the system with more than one hue at rest, and still deliberately desaturated at the low end.

### Named Rules
**The No-Hue Accent Rule.** The default "brand color" is not a color at all — it's black. Before adding an actual brand hue system-wide, add it through the existing per-user Settings override, not as a new hardcoded token.

**The Two-State Signal Rule.** Status badges show only two states: *open* (Console Black — covers both 진행전 and 진행중, not visually distinguished from each other) and *closed* (Fog gray). Urgency is layered on separately via the standalone red 지연 badge.

## Typography

**Body/Display/Label Font:** **Inter** (`next/font/google`, Latin subset) with an explicit fallback chain — `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Segoe UI", Roboto, sans-serif` — so every Hangul character (which Inter doesn't cover) falls through cleanly to the visitor's OS Korean UI font instead of an undefined/tofu render.

**Character:** confident but not shouty — Inter's geometric-humanist Latin forms pair with sentence-style Korean labels; medium weight carries emphasis, no heavier display face.

### Hierarchy
- **Title** (medium/500, 16-18px, tight line-height): page headers, project/task names, dialog and sheet titles.
- **Body** (regular/400, 14px, 1.5 line-height): default UI text, memos, comments.
- **Label** (medium/500, 12-13px): badges, meta rows (master명, 참여자 수, 코멘트 수, 날짜), nav labels.

### Named Rules
**The Explicit-Fallback Rule.** Never let `--font-sans` resolve to a font-only stack without an explicit non-Latin fallback appended — this system shipped broken once already (Inter/Geist with no Korean fallback) before this fix. Any future font change must keep the Korean fallback chain intact.

## Layout

Unchanged from before: responsive card grid (phone ~2 columns, tablet ~3, desktop 4 via `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`), a manual desktop width toggle (넓게/패드/폰), a fixed top header and fixed bottom navigation bar on authenticated screens. Card grids keep a consistent gap and one shared internal padding scale.

## Elevation & Depth

Elevation now means something different than before: **containers float, controls stay flat.** Cards, Dialog content, Popover content, and the Sheet drawer all carry a real `box-shadow` plus a subtle ring at rest — they are meant to read as physically lifted above the page. Buttons, inputs, textareas, checkboxes, and badges stay flat and filled/bordered — shadow is reserved for things big enough to be a "surface," not for individual controls.

### Shadow Vocabulary
- **Card lift** (`shadow-md`, ring `foreground/5` light · `foreground/10` dark): the default resting elevation for `Card`.
- **Dialog lift** (`shadow-xl`, same ring treatment, `bg-black/30` backdrop + `backdrop-blur-sm`): modal content — noticeably heavier backdrop than before (was `black/10` + `blur-xs`).
- **Popover lift** (`shadow-lg`): notification/menu popovers.
- **Drawer lift** (`shadow-xl`-equivalent, `bg-black/30` backdrop): the task-detail Sheet.
- **Canvas-lift** (`shadow-sm`): React Flow task nodes, unchanged — still the lightest touch in the system since it only needs to separate from the canvas grid, not float above the whole page.
- **Chrome separator** (`shadow-sm` on the header; `shadow-[0_-1px_3px_rgba(0,0,0,0.06)]` on the bottom nav): the fixed top header and bottom navigation bar no longer use a hairline border to separate from content — they cast a soft shadow toward the content instead, consistent with the system-wide move away from hairline dividers.

### Named Rules
**The Float-or-Flat Rule.** If a component is a container people read other components *inside of* (Card, Dialog, Popover, Sheet), it floats — real shadow, real lift. If it's a single control (Button, Input, Textarea, Checkbox, Badge), it stays flat — no shadow, ever. There is no in-between tier.

## Shapes

Meaningfully rounder than before, still built off the same base radius token (`--radius: 0.625rem`, scaled by `calc()`):
- **26px (`rounded-4xl`)** — Card and Dialog content: the two biggest floating surfaces get the roundest corners.
- **22px (`rounded-3xl`)** — Badge, Input, Popover content: the mid-size scale.
- **18px (`rounded-2xl`)** — Textarea.
- **Fully round** — Button (pill, given its height), the "AR" logo mark, the primary "+" add-project action.

Borders inside the shadcn primitives have mostly given way to `border-transparent` + a filled/tinted background (Input, Textarea, Checkbox) — the hairline-border language survives only in the hand-built app surfaces that the preset didn't touch (see Do's and Don'ts).

## Components

### Buttons
- **Shape:** pill (`rounded-4xl`), 36px height at default size (up from 32px).
- **Primary:** Console Black fill, white text, hover dims to 80% opacity.
- **Outline:** transparent/white fill, Hairline border, hover fills to Fog gray.
- **Destructive:** tinted red (`bg-destructive/10`, red text) — deliberately quieter than the solid Alert Red reserved for the overdue badge.
- Focus ring softened slightly system-wide: `ring-*/30` opacity (was `/50`).

### Badges
- **Style:** pill-shaped (`rounded-3xl`), 20px tall, 12px label text.
- **Status:** two states only — open (Console Black fill) / closed (Fog fill) — per the Two-State Signal rule.
- **Overdue:** solid Alert Red, always alongside (never instead of) the status badge.
- **Visibility:** 공개 = Fog-filled secondary badge; 비공개 = outlined badge — the one badge variant still using a real border.

### Cards / Containers
- **Card** (shadcn primitive): 26px radius, Paper background, `shadow-md` + subtle ring, generous internal padding (24px). Used inside dialogs/task detail.
- **Task Card** (hand-built, now unified): 26px radius, Paper background, `shadow-md` + subtle ring — hairline border removed in favor of the same float treatment as the Card primitive. Hover deepens to `shadow-lg` rather than tinting the fill.
- **Project Card** (hand-built, now unified): 26px radius, Paper background, `shadow-md` + subtle ring — the flat Fog-gray fill is gone; it now floats like every other container. Hover deepens to `shadow-lg`.
- **Dashboard Summary Card** (hand-built, now unified): same 26px/`shadow-md`/ring treatment as Task Card and Project Card — the hairline border is gone.

### Inputs / Fields
- **Style:** 22px radius, transparent border, filled `bg-input/50` background (no longer a hairline-bordered transparent field), 36px height.
- **Focus:** border shifts to the active accent (Console Black by default, or the user's personal color) with a soft `ring/30` halo.
- **Textarea:** 18px radius, same filled-background treatment, no longer resizable (`resize-none`).
- **Native `<select>` elements** still share this input visual language rather than a distinct control.

### Navigation
- **Top header / Bottom Navigation:** Paper background, no border — separation from content is now a soft chrome-separator shadow (see Elevation & Depth) rather than a hairline divider. Icons are Tabler (`IconLayoutGrid`, `IconFolder`, `IconCalendar`, `IconSitemap`, `IconSettings`) instead of Lucide.

## Do's and Don'ts

### Do:
- **Do** keep the default accent black — reach for the per-user Settings color override before hardcoding a new brand hue anywhere.
- **Do** give containers (Card/Dialog/Popover/Sheet) real shadow + generous rounding; keep controls (Button/Input/Badge/Checkbox) flat.
- **Do** keep destructive actions in the quieter tinted-red register; solid Alert Red stays reserved for the 지연 (overdue) signal alone.
- **Do** use only `@tabler/icons-react` for icons — `lucide-react` was fully removed; don't reintroduce a second icon library.
- **Do** keep any font-stack change explicit about its non-Latin fallback — this system broke Korean rendering twice already from font changes that forgot it.

### Don't:
- **Don't** give 진행전 and 진행중 different status-badge colors — they intentionally share the "open" black.
- **Don't** add a shadow to Button, Input, Badge, or Checkbox — shadow is reserved for container-level surfaces only.
- **Don't** assume every hairline divider in the app is gone: `task-status-groups.tsx`'s internal section divider and the desktop width-toggle bar (`width-container.tsx`) still use the old 0.5px hairline border — they're minor, secondary chrome, not top-level surfaces, and weren't in scope for this pass. The dashboard summary cards, project/task cards, and header/bottom-nav are now fully unified with the Float-or-Flat Rule.

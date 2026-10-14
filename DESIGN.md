---
name: AR_PM
description: A bold, tactile "command board" for a small trusted team — monochrome black accent, soft-lifted cards, Tabler iconography.
colors:
  console-black: "#171717"
  paper: "#ffffff"
  canvas: "#f0f0f0"
  ink: "#0a0a0a"
  fog: "#f5f5f5"
  ash: "#737373"
  hairline: "#e5e5e5"
  focus-steel: "#a1a1a1"
  alert-red: "#e7000b"
  done-green: "#047857"
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
  badge-status-todo:
    backgroundColor: "transparent"
    borderColor: "{colors.hairline}"
    textColor: "{colors.ink}"
    rounded: "{rounded.3xl}"
    padding: "2px 8px"
    height: "20px"
  badge-status-in-progress:
    backgroundColor: "{colors.console-black}"
    textColor: "{colors.paper}"
    rounded: "{rounded.3xl}"
    padding: "2px 8px"
    height: "20px"
  badge-status-done:
    backgroundColor: "rgba(16, 185, 129, 0.15)"
    textColor: "{colors.done-green}"
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

> 마지막 갱신: 2026-10-14. 상태 배지 3색 전환(09-11), 앱 아이콘 로고(08-31), 고정 폭 레이아웃,
> 하단 탭 재구성(09-09)을 반영했습니다. 배경은 [`docs/HISTORY.md`](docs/HISTORY.md)에 있습니다.

## Overview

**Creative North Star: "The Command Board"**

AR_PM reads less like a quiet ledger now and more like a control surface a team actually commands from: bold, tactile, confident. There is no colored brand hue anywhere in the system — the "accent" is simply the darkest point of one continuous black-to-white neutral ramp, so buttons and the in-progress status badge are pure near-black rather than a tinted brand color. Containers — cards, dialogs, popovers, the task-detail sheet — now genuinely float: they carry real, soft shadows and generous rounding (22-26px), a deliberate move away from the earlier flat/hairline treatment. Controls — buttons, inputs, badges, checkboxes — stay flat and filled rather than shadowed, so the floating/flat distinction still tracks which components are "surfaces" versus "instruments" within them.

Red is still the one true hue reserved exclusively for urgency (지연/overdue), and a quiet green marks only "완료". Partners carry a pastel identity color chosen from presets — that is data (which partner is this?), not decoration. Individual users can opt into a personal accent hue via Settings (a single custom color override on top of the monochrome default) — that capability is unchanged from before and remains the one sanctioned way color enters the system.

**Key Characteristics:**
- No brand hue at rest — the primary "accent" is the black end of the neutral scale, not a separate color.
- Containers float (soft shadow + 22-26px rounding); controls stay flat and filled.
- Red is reserved exclusively for the overdue signal; green only for "완료"; users may opt into a personal accent color in Settings.
- Status badges have three distinct looks — outline (진행전), filled black (진행중), soft green (완료).
- The logo is the app icon itself, the same image as the installed PWA icon.
- Tabler iconography throughout (no more mixed icon libraries).
- Korean-safe typography: Inter carries Latin/numeral text, falling through cleanly to the OS's own Korean UI font for Hangul.

## Colors

Effectively monochrome at rest: one neutral ramp from white to near-black carries every structural and "active" meaning; red is carved out exclusively for urgency; a personal accent hue is available only as an explicit per-user opt-in.

### Primary
- **Console Black** (`#171717` / `oklch(0.205 0 0)`): the system's only "accent," and it isn't a hue — it's the darkest step of the neutral ramp. Used for the primary button fill, the 진행중 status badge (see the Three-State Status rule), and links-as-actions. Users may override this per-account with a real color from Settings; until they do, it stays black.

### Neutral
- **Paper** (`#ffffff`): card, dialog, header and bottom-nav surface.
- **Canvas** (`#f0f0f0` / `oklch(0.955 0 0)`): the page background behind cards. It sits one step below Paper so cards visibly float (changed 2026-08-12; the dark theme already separated page < card).
- **Ink** (`#0a0a0a`): primary text.
- **Fog** (`#f5f5f5`): secondary/muted fill — "closed" status badges, the project-card background block, filled input backgrounds.
- **Ash** (`#737373`): muted/secondary text (timestamps, counts, helper copy).
- **Hairline** (`#e5e5e5`): the border/divider color wherever a border still appears (mostly outside the shadcn primitives now — see Do's and Don'ts).
- **Focus Steel** (`#a1a1a1`): the default focus-ring color when no personal accent is set — neutral, not tinted, unlike the earlier accent-colored ring.

### Alert (functional, not decorative)
- **Alert Red** (`#e7000b` / `oklch(0.577 0.245 27.325)`): exclusively the "지연" (overdue) badge. Destructive buttons use a quieter *tinted* red fill, never this solid tone — solid red stays a single-purpose urgency signal.

### Done (functional)
- **Done Green** (`#047857` text on an `emerald-500/15` fill; `emerald-300` text in dark): exclusively the 완료 status badge. Defined once as `STATUS_BADGE_CLASS` in `lib/priority.ts`.

### Partner Colors (data, not decoration)
- A pastel preset palette (8 shown, 16 with "더보기") that a partner admin assigns. It appears as a dot, a tinted node background in 워크플로우, and chips in the calendar — always to answer "which partner?". "색상 없음" is a valid choice.
- Google calendar colors on calendar chips (left border) are the same kind of data; that file is the one sanctioned exception to the side-tab rule (`.impeccable/config.json`).

### Priority Dots (participant-level)
- Three levels since 2026-08-07: **긴급** (red), **보통**, **보류** (the default since 2026-08-10). Small dots per participant on project cards; click your own dot to change it.

### Named Rules
**The No-Hue Accent Rule.** The default "brand color" is not a color at all — it's black. Before adding an actual brand hue system-wide, add it through the existing per-user Settings override, not as a new hardcoded token.

**The Three-State Status Rule.** (Replaced the earlier Two-State rule on 2026-09-11 — with 진행전 and 진행중 both black, nobody could tell from the badge whether work had started.) 진행전 = outline only (quiet: nothing is happening yet), 진행중 = filled Console Black (loudest: this is what's moving now), 완료 = soft green (finished, out of the way). Urgency is still layered on separately via the standalone red 지연 badge.

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

- **Fixed max width.** Content, header and bottom nav all cap at `max-w-5xl` (1024px), centered. The old 넓게/패드/폰 width toggle was removed on 2026-08-07 at the user's request.
- **Card grids:** two columns even on phones (project and partner cards), three to four on wider screens. Titles in narrow cards use `break-keep` + `[overflow-wrap:anywhere]` + `line-clamp-2` so long Korean names neither break per character nor overflow.
- **Top bar (`AppHeader`)** on every authenticated screen: left = app-icon logo menu (설정 · 로그아웃) + page title; right = page actions + search (opens with Ctrl/Cmd+K) + notification bell, always in the same spot. Search and bell are the same 44px outline icon buttons.
- **Create buttons (`CreateButton`)** sit directly above the list they add to, never in the top bar — "새 파트너" beside the 파트너 heading, "새 프로젝트" above project lists, "태스크 추가" above the task list.
- **Bottom navigation**, six tabs in this order: 홈 · 파트너 · 전체 프로젝트 · 태스크 · 코멘트 · 캘린더. ←/→ arrow keys move between tabs (not while typing, holding a modifier, or with a dialog open).
- **Chat** is a floating round button above the bottom nav, bottom-right.

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
- **Fully round** — Button (pill, given its height), the app-icon logo, avatars, the floating chat button.

Borders inside the shadcn primitives have mostly given way to `border-transparent` + a filled/tinted background (Input, Textarea, Checkbox). The hairline-border language is now fully retired across every top-level surface in the app — the last hand-built holdouts (project/task/summary cards, the status-group card, the header, the bottom nav, the width-toggle bar) have all moved to the shadow-based Float-or-Flat treatment.

## Components

### Buttons
- **Shape:** pill (`rounded-4xl`), 36px height at default size (up from 32px).
- **Primary:** Console Black fill, white text, hover dims to 80% opacity.
- **Outline:** transparent/white fill, Hairline border, hover fills to Fog gray.
- **Destructive:** tinted red (`bg-destructive/10`, red text) — deliberately quieter than the solid Alert Red reserved for the overdue badge.
- Focus ring softened slightly system-wide: `ring-*/30` opacity (was `/50`).

### Badges
- **Style:** pill-shaped (`rounded-3xl`), 20px tall, 12px label text.
- **Status:** three looks — 진행전 outline / 진행중 Console Black fill / 완료 soft green — per the Three-State Status rule. Tapping a status badge on a card changes the status (on phones this is the main way, since dragging between groups is impractical).
- **Overdue:** solid Alert Red, always alongside (never instead of) the status badge.
- **Visibility:** 공개 = Fog-filled secondary badge; 비공개 = outlined badge — the one badge variant still using a real border.

### Cards / Containers
- **Card** (shadcn primitive): 26px radius, Paper background, `shadow-md` + subtle ring, generous internal padding (24px). Used inside dialogs/task detail.
- **Task Card** (hand-built, now unified): 26px radius, Paper background, `shadow-md` + subtle ring — hairline border removed in favor of the same float treatment as the Card primitive. Hover deepens to `shadow-lg` rather than tinting the fill.
- **Project Card** (hand-built, now unified): 26px radius, Paper background, `shadow-md` + subtle ring — the flat Fog-gray fill is gone; it now floats like every other container. Hover deepens to `shadow-lg`.
- **Dashboard Summary Card** (hand-built, now unified): same 26px/`shadow-md`/ring treatment as Task Card and Project Card — the hairline border is gone.
- **Status Group Card** (hand-built `<details>` in `task-status-groups.tsx`, now unified): same 26px/`shadow-md`/ring container treatment; the internal divider between the summary row and the task grid was removed rather than replaced — padding alone now separates them.

### Inputs / Fields
- **Style:** 22px radius, transparent border, filled `bg-input/50` background (no longer a hairline-bordered transparent field), 36px height.
- **Focus:** border shifts to the active accent (Console Black by default, or the user's personal color) with a soft `ring/30` halo.
- **Textarea:** 18px radius, same filled-background treatment, no longer resizable (`resize-none`).
- **Native `<select>` elements** still share this input visual language rather than a distinct control.

### Navigation
- **Top header / Bottom Navigation:** Paper background, no border — separation from content is a soft chrome-separator shadow (see Elevation & Depth) rather than a hairline divider.
- **Bottom nav icons (Tabler):** 홈 `IconLayoutGrid`, 파트너 `IconBuilding`, 전체 프로젝트 `IconChecklist`, 태스크 `IconListCheck`, 코멘트 `IconMessage`, 캘린더 `IconCalendar`.
- **파트너 tab** shows the last-visited partner's name (abbreviated). Outside a partner page it jumps straight there; on a partner page (or with no history) it opens a popover list of partners to switch to.
- **Logo menu:** the app icon (same file as the PWA icon) opens 설정 · 로그아웃. Settings is no longer a tab.

## Do's and Don'ts

### Do:
- **Do** keep the default accent black — reach for the per-user Settings color override before hardcoding a new brand hue anywhere.
- **Do** give containers (Card/Dialog/Popover/Sheet) real shadow + generous rounding; keep controls (Button/Input/Badge/Checkbox) flat.
- **Do** keep destructive actions in the quieter tinted-red register; solid Alert Red stays reserved for the 지연 (overdue) signal alone.
- **Do** use only `@tabler/icons-react` for icons — `lucide-react` was fully removed; don't reintroduce a second icon library.
- **Do** keep any font-stack change explicit about its non-Latin fallback — this system broke Korean rendering twice already from font changes that forgot it.

### Don't:
- **Don't** collapse 진행전 and 진행중 back into one color — that was the old Two-State rule, retired because the badge stopped carrying information. Change `STATUS_BADGE_CLASS` in one place instead of styling badges per screen.
- **Don't** put create buttons in the top bar — they belong directly above the list they add to.
- **Don't** add a shadow to Button, Input, Badge, or Checkbox — shadow is reserved for container-level surfaces only.
- **Don't** reintroduce a 0.5px hairline border anywhere in the app — every surface (project/task/summary/status-group cards, header, bottom nav, desktop width-toggle bar) has been moved to the shadow-based Float-or-Flat treatment. There are no remaining exceptions as of this pass.

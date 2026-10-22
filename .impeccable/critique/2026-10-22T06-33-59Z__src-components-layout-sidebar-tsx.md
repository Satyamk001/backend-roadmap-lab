---
target: src/components/layout/Sidebar.tsx
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:D:\\Satyam (CE00172125)\\learn\\AI+Backend Role Prep\\src\\components\\layout\\Sidebar.tsx"
target_fingerprint: "sha256:6c72906c15c356eec00a38123bc29a67733a15c599bd9f5cf82c2a30657e3676"
target_path: "D:\\Satyam (CE00172125)\\learn\\AI+Backend Role Prep\\src\\components\\layout\\Sidebar.tsx"
timestamp: 2026-10-22T06-33-59Z
slug: src-components-layout-sidebar-tsx
---
# Design Critique: Sidebar navigation — Backend Roadmap Lab

**Target**: `src/components/layout/Sidebar.tsx` (desktop sidebar + mobile slide-over)
**Mode**: Operate (navigation), with Read context
**Rendered review**: 1440×900 and 1440×600, 390×844, light and dark; active day 38, home, stage switch, collapsed active stage, unknown day.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Active day is strongly marked; on home S6 is open with no active state. |
| 2 | Match System / Real World | 3/4 | Stage/day model fits the roadmap; footer uses publishing-pipeline language. |
| 3 | User Control and Freedom | 2/4 | Mobile drawer: no Escape, no focus trap, no focus return, page scrolls behind. |
| 4 | Consistency and Standards | 2/4 | Active stage and active day share the same fill; hover equals selection. |
| 5 | Error Prevention | 3/4 | No destructive actions; unknown day silently redirects. |
| 6 | Recognition Rather Than Recall | 2/4 | No visited/progress marks; collapsed stages hide days; no scroll-to-active at scale. |
| 7 | Flexibility and Efficiency | 3/4 | Global Ctrl+K palette is a real accelerator; sidebar has no collapse-all or resume. |
| 8 | Aesthetic and Minimalist Design | 2/4 | Calm at a glance, but the footer caveat and uppercase micro-label are non-learner chrome. |
| 9 | Error Recovery | 3/4 | Bad day URL lands on a valid page, but with no explanation and no active context. |
| 10 | Help and Documentation | 2/4 | Labels are self-explanatory; the only help raises a question it does not answer. |
| **Total** | | **25/40** | **Acceptable (62.5%)** |

## Design Specificity Verdict

**LLM assessment**: Partly authored. The measured rail and amber node are a genuine idea — a roadmap you move along — and the Stage > Day hierarchy matches the product's information model. But the rows themselves are a generic docs accordion: calendar glyph, bold title, muted day number. There is no demo count, no visited state, no next step. Replace the labels and it could be any course-platform sidebar. The footer ("3 stages published", "Missing stage numbers aren't filtered out…") reads like a build dashboard, the opposite of learner-specific.

**Deterministic scan**: `impeccable detect --json src/components/layout/Sidebar.tsx` returned `[]`, exit 0; the parent directory scan was also clean. The browser overlay found 15 anti-patterns page-wide in light, 12 in dark, 4 on mobile. Only `tiny-text` intersects this target (six 11px instances page-wide; three are the sidebar "Day N" labels). `low-contrast` (emerald 3.8:1), `skipped-heading`, `cream-palette`, `overused-font`, and five `nested-cards` findings belong to the main content, outside this scope. The CLI's clean result is a false negative for class-driven type sizes; the overlay caught them.

**Visual overlays**: Injection succeeded and the overlay bar ran in the headless tab. No `[Human]` tab was presented because the browser work was headless; evidence is in `01-overlay-desktop-light.png`, `02-overlay-desktop-dark.png`, and `03-overlay-mobile-light.png`.

## Overall Impression

At 1440 the sidebar is calm, legible, and the rail is the one moment of craft. On a phone it stops behaving like navigation and becomes a visual panel: focus stays behind it, Escape does nothing, and the page scrolls underneath. The biggest opportunity is to let the roadmap carry the learner's progress instead of only the content tree.

## What's Working

1. **The hierarchy matches the product.** Stage > Day only, one stage open, no demos in the sidebar — exactly the contract, and it keeps the list short.
2. **Active state is multimodal, not colour-only.** Tint + 700 weight + amber day label + rail node; `aria-current="page"` and `aria-expanded` are correct, and the node is one shared element measured with a ResizeObserver.
3. **The rail is a real product idea.** The measured node gliding to the active day makes the list feel like a path rather than a menu, and the global reduced-motion rule disables the transition.

## Priority Issues

### [P1] The mobile drawer is a visual panel, not a dialog
- **What**: 320px drawer has no `role="dialog"`, `aria-modal`, or accessible name; focus stays on "Open navigation menu"; Tab goes through the site logo, search and theme toggle behind the overlay before reaching "Close menu"; Escape leaves it open; `body` overflow is `visible` and `scrollY` moves to 200 while open; after choosing a day, focus falls to `<body>`. The `animate-in`/`slide-in-from-left` classes resolve to `animationName: none` because `tailwindcss-animate` is not installed.
- **Why it matters**: Keyboard and screen-reader users lose the modal boundary and their place; touch users can scroll the page behind the drawer; the jump cut makes the drawer feel unfinished.
- **Fix**: Use `<dialog>` or `role="dialog" aria-modal="true" aria-labelledby`; focus the close button or active day on open; trap Tab; close on Escape; set `overflow: hidden` on `<body>`; return focus to the hamburger on close and focus the page heading after navigation. Add a real enter/exit transition or remove the dead classes. Make the close target 44×44.
- **Suggested command**: `/impeccable harden`

### [P1] The type scale is below the product floor, and the orientation cue is the smallest text
- **What**: Day title 14px/19.25, stage header 14px, section label 12px mono uppercase, "Day N" 11px/15.125, footer 13/12. `AGENTS.md` requires 15–16px minimum for labels and body; the overlay flags 11px as `tiny-text`. Light active "Day 38" is #B45309 on #FEF3C7 = 4.51:1 — technically AA, but fragile at 11px.
- **Why it matters**: The day number is how a learner confirms where they are. At 11px, low-vision users and phones in sunlight lose it, and the sidebar becomes harder to scan than the content it navigates.
- **Fix**: 15px day title, 13–15px "Day N" (never 11), 15px stage header; use weight and colour for hierarchy instead of shrinking. Raise the section label to sentence case 12px or remove it. Keep 11px for data chips inside demos, not navigation.
- **Suggested command**: `/impeccable typeset`

### [P2] Active stage and active day share the same amber fill; hover matches selection
- **What**: Active stage bg `#FEF3C7` and active day bg `#FEF3C7`; inactive hover is the same `#FEF3C7`. In dark both are `#292524`. Weight, the 11px amber day number, and the node are the only differentiators.
- **Why it matters**: Amber becomes a background (against the design contract), two "selected" blocks compete, and hovering an unselected row looks like selecting it. On dark the two fills are nearly indistinguishable from the card.
- **Fix**: Keep the stage header neutral and mark it with a 2px amber rail segment or a small "current" label; reserve the tint for the active day; make hover a neutral stone or a border, never the selected fill. Keep the node as the single amber motion cue.
- **Suggested command**: `/impeccable quieter`

### [P2] The footer is internal publishing copy, and the nav ends on a caveat
- **What**: "3 stages published" plus "Missing stage numbers aren't filtered out—they haven't been published yet." is always visible; it takes an 80px block at 1440 and sits under the only day row on mobile. "STAGES & DAYS" is a 12px uppercase mono micro-label above the list.
- **Why it matters**: Learners do not need the content pipeline. The note makes the roadmap feel incomplete, raises "where are stages 2, 3, 5?" and does not answer it, and is the last thing in the nav — a peak-end downbeat.
- **Fix**: Remove both paragraphs; if gaps need explaining, use one "Stages 2, 3 and 5 are coming soon" line behind a help affordance, or show "3 of 6 stages" as progress. Replace the micro-label with sentence case ("Your roadmap") or drop it.
- **Suggested command**: `/impeccable clarify`

### [P2] The roadmap has no memory of progress
- **What**: `useSettingsStore` already tracks `visitedDemos` and `completedChallenges`, but the sidebar renders only the active day. No visited tick, no per-day demo count, no "resume" action. With 16 demos across 3 days this is tolerable; at 10+ days the user must remember.
- **Why it matters**: Recognition over recall. A learning roadmap's main job is "where am I, what's next"; this one only answers "which page is open".
- **Fix**: Add a subtle visited marker (small check or 2px dot, never colour alone) per day, a "3/6 demos" count for the active day, and a "Resume Day 38" link at the top of the sidebar using the existing `visitedDemos` state.
- **Suggested command**: `/impeccable onboard`

## Persona Red Flags

**Jordan (First-Timer)**: "S1/S4/S6" and "Day 38" assume the numbering model; the footer explains publishing gaps in internal terms and never says what a stage is. The calendar glyph looks like a date, but Day 38 is a sequence. No demo count says a day contains six demos.

**Sam (Screen reader / keyboard)**: The exact mobile failures above. On desktop, each day link contains an unnamed image (the exposed Calendar icon) announced alongside the label; there is no `<nav>` landmark (the `<aside>` is unlabeled); the close button is 28×28; the "Day N" labels are 11px. The focus ring is correct once settled: 3px amber, 2px offset.

**Casey (Mobile, interrupted)**: The 320px drawer covers 82% of a 390px screen. The close target is 28×28 and the hamburger 32×32, both below 44×44; stage rows are 35px high. The page scrolls behind the drawer, selecting a day closes it but drops focus to `<body>`, and the missing transition makes it a jump cut.

## Minor Observations

- There is no collapse-all, no recent/next-day link, and no scroll-to-active when a stage grows; with 10+ days the active row can open off-screen. Ctrl+K is the only power path.
- Collapsing the active stage leaves the header tinted but removes the day; reopening is a two-click memory test.

- On home, S6 is expanded by the `stageId || 's6-queues-async'` fallback with no active stage; S1/S4 are collapsed. It reads as an unexplained default — collapse all, or label S6 as the current stage.
- `/stage/s6-queues-async/day/99` silently redirects to home; the sidebar loses all active state and the node, with no "Day not found" explanation. A small not-found message with a link back would recover better.
- The calendar icon on every day row is decorative noise, semantically wrong, and exposed to screen readers as an unnamed image; the day number is the real anchor. Replace it with an aria-hidden ordinal chip.
- Stage buttons lack `aria-controls`; `title` tooltips duplicate the visible label and never appear on touch.
- The sidebar is 1px taller than the viewport (844px starting at y=57 in a 900px viewport), so its bottom sits just below the fold.
- Light rail contrast is 1.49:1 and the node is 1.93:1 against the tinted row, below 3:1 for meaningful graphics. The node has a glow plus weight/tint backups, so it is not the sole signal, but it should not be relied on at low vision.
- "STAGES & DAYS" is the only all-mono uppercase micro-label in the nav; the project contract bans uppercase micro-labels.

## Questions to Consider

- If the roadmap is the spine of the product, why does the sidebar show no sign of how far the learner has walked?
- What if only the active day were amber-filled, and the stage were marked by the rail?
- Does "3 stages published" belong in a learner's navigation at all?
- Should the mobile drawer share the command palette's dialog contract (focus trap, Escape, return focus)?
- What would a "resume where you left off" row at the top of the sidebar do to the first five seconds?

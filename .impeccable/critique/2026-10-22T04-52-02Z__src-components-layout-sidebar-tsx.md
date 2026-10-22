---
target: sidebar (Stage > Day navigation)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:D:\\Satyam (CE00172125)\\learn\\AI+Backend Role Prep\\src\\components\\layout\\Sidebar.tsx"
target_fingerprint: "sha256:6c72906c15c356eec00a38123bc29a67733a15c599bd9f5cf82c2a30657e3676"
target_path: "D:\\Satyam (CE00172125)\\learn\\AI+Backend Role Prep\\src\\components\\layout\\Sidebar.tsx"
timestamp: 2026-10-22T04-52-02Z
slug: src-components-layout-sidebar-tsx
---
⚠️ DEGRADED: single-context (the harness caps sub-agent depth at 1, so the isolated A/B sub-agents the critique flow requires could not be spawned; A was recorded before any detector output, then B ran, in this context)

### Design Health Score

| # | Heuristic | Score | Key Issue |
| --- | ----------- | ------- | ----------- |
| 1 | Visibility of System Status | 3 | Current day is marked four ways (tint, bold, node, `aria-current`), but collapsing its stage hides it and nothing else in the rail says "Day 38". |
| 2 | Match System / Real World | 3 | Day order and numbering match how the notes are studied; `S1:` / `S4:` prefixes and raw Notion task names are system language, not learner language. |
| 3 | User Control and Freedom | 2 | The active stage can be collapsed; the mobile drawer ignores Escape; there is no Overview/Home row. |
| 4 | Consistency and Standards | 2 | Stage and day rows are both 14px, but the day is *bolder* (700 vs 600); two different active treatments; `shadow-xs` (line 178) is not a Tailwind 3 class, so the claimed shadow never renders. |
| 5 | Error Prevention | 3 | Nothing destructive; but focus is never managed, so keyboard users fall behind the overlay. |
| 6 | Recognition Rather Than Recall | 2 | 2–3 line wrapped task strings and an identical calendar icon on every row make scanning slow; no signal of what a stage contains without expanding it. |
| 7 | Flexibility and Efficiency | 2 | The rail is click-only: no typeahead, no collapse-all, no jump-to-current, no Escape. `Ctrl K` exists in the navbar but is not part of the rail. |
| 8 | Aesthetic and Minimalist Design | 2 | Three amber cues stack on the current location; the bottom third of the 320px rail is empty while rows are dense; an uppercase mono micro-label adds chrome without meaning. |
| 9 | Error Recovery | 3 | Unknown day/stage redirects home; nothing in the rail can fail. |
| 10 | Help and Documentation | 2 | No legend for the rail node, no explanation of missing stage numbers except a publishing disclaimer. |
| **Total** | | **24/40** | **Acceptable (60%)** |

### Design Specificity Verdict

**LLM assessment**: The rail-plus-node is the one authored idea here: a single hairline that runs the length of the stage, one 9px amber node that measures the active row once and moves by transform. That is a real "roadmap as progression" gesture, not a component-library default. Everything around it is interchangeable docs chrome — chevron accordions, a tinted active row, a calendar icon repeated on every day, an uppercase monospace section label. Worse, the most product-specific text in the file is also the least designed: day labels are pasted Notion task strings, and the only permanent footer is a note about unpublished stage numbers. A learner sees a task backlog with a glowing dot, not a path they are moving along. The rail never uses the progress the app already tracks (`visitedDemos`, `completedChallenges`), which is the obvious roadmapping material.

**Deterministic scan**: `impeccable detect --json src/components/layout/Sidebar.tsx` returned **0 findings (exit 0)**. A live overlay injection on the day page reported **15 page-level anti-patterns** (`tiny-text` ×6, `low-contrast` ×3, `skipped-heading`, `overused-font`, `cream-palette`, `nested-cards` ×2); **none of the reported selectors resolve to an element inside the rail** — the six 11px spans are demo chrome, the emerald contrast failures are demo text, and `cream-palette` is this project's mandated `--bg` token, so it is a false positive against the brief. The rail is mechanically clean; its problems are semantic, typographic and structural, which is why the detector cannot see them.

**Visual overlays**: injection succeeded in a headless Chrome at 1440×1000 (`C:\Users\CE00172125\AppData\Local\Temp\opencode\sidereview\overlay-desktop.png`), and the overlay drew badges across the content column. No overlay boxes land in the sidebar. The live server was stopped with `--keep-inject`; the project's HTML was not edited.

### Overall Impression

The rail is calm, readable and technically careful — it generates nav from content, keeps labels wrapped instead of truncated, and the moving node is a small, genuine delight. But it behaves like a file tree: no progress, no current-location summary when collapsed, and a drawer that looks like a modal while being semantically invisible. The single biggest opportunity is to let the rail answer "where am I and what's next?" — not "what files exist".

### What's Working

1. **One rail, one node.** A single measured node moved with `translateY` keeps the DOM light and gives the list a shared spine. It reads instantly as a sequence, which is exactly the mental model of a roadmap.
2. **Redundant active state.** Tint + weight + amber node + `aria-current="page"` means colour is never the only signal, and a test locks the node to the active row.
3. **Content-generated, wrap-first labels.** Navigation comes from `content/` with no hardcoded links, and the recent switch from truncation to `break-words` keeps long task names legible in a 320px column.

### Priority Issues

- **[P1] The mobile drawer looks like a dialog but is semantically nothing.**
  - *Why it matters*: measured at 390×844, opening it leaves `document.activeElement` on `<body>`; the panel is a `div` with no `role`, no `aria-modal`, no accessible name; **35 focusable elements behind the overlay stay tabbable**; Tab from the last drawer item lands on the "Roadmap" breadcrumb behind the dimmer; Escape does nothing; body scroll is not locked; focus is not restored to the hamburger. A keyboard or screen-reader learner can neither operate nor reliably dismiss it.
  - *Fix*: render the panel as `role="dialog" aria-modal="true" aria-label="Roadmap navigation"`, move focus to the first stage button (or the close button) on open, trap Tab/Shift+Tab, close on Escape, lock `body` scroll, restore focus to the trigger, and wrap both the desktop rail and drawer contents in `<nav aria-label="Roadmap">`.
  - *Suggested command*: `/impeccable harden`

- **[P1] Typography breaks the project floor and inverts the hierarchy.**
  - *Why it matters*: measured in both themes — stage title `14px/600`, day title `14px/700`, day number `11px`, section label `12px` uppercase JetBrains Mono. AGENTS §6 requires 15–16px minimum, sentence case, and no uppercase micro-labels or all-monospace UI; §9's checklist literally says "body text is 15px or larger". The day being heavier than its stage flattens the map: at a glance, all seven rows weigh the same.
  - *Fix*: stage title 15–16px/600 with the stage number as a small neutral kicker; day title 15px/500 (600 when active); day number 13px sentence case in `--text-muted`; replace "Stages & Days" with a 13px sans "Roadmap" or drop it (the drawer already has a title).
  - *Suggested command*: `/impeccable typeset`

- **[P1] The rail's open/closed state ignores where the learner is.**
  - *Why it matters*: `Sidebar.tsx:128` hardcodes `'s6-queues-async'` as the default expanded stage, so the home page opens S6 for no reason; and `isExpanded = expandedStages[stage.id] ?? isStageActive` lets a single click collapse the stage that contains the current day. After that click the active tint remains but the day disappears — the rail stops answering "where am I?" exactly when a learner needs it.
  - *Fix*: keep the stage owning the active day expanded, or show a compact current-day chip in a collapsed header ("S6 · Day 38"); default to the last visited stage from `localStorage` instead of a literal.
  - *Suggested command*: `/impeccable clarify`

- **[P2] Day rows are raw Notion task strings.**
  - *Why it matters*: "Queue concepts (at-least-once, ordering, DLQ) + BullMQ" wraps to three lines; the active row measures 72px. With three days it merely looks untidy; with sixteen it becomes a wall of parentheticals, and finding "the Kafka one" turns into reading rather than scanning.
  - *Fix*: add a short `navTitle` (≤28 characters, noun phrase: "Queue concepts", "RabbitMQ routing", "Kafka fundamentals") to each `meta.json` and fall back to `trackerTask`; keep the full string as the link's accessible name and `title`.
  - *Suggested command*: `/impeccable distill`

- **[P2] The bottom slot sells publishing state, not the roadmap.**
  - *Why it matters*: "3 stages published" and "Missing stage numbers aren't filtered out—they haven't been published yet" is build-log copy occupying the only permanent, always-visible slot in the rail. It explains a gap the learner has no reason to care about and makes the product feel like an internal tool.
  - *Fix*: replace it with progress the store already knows (demos visited or challenges completed per stage), or remove it and move the publishing caveat to the stage page's empty state.
  - *Suggested command*: `/impeccable onboard`

- **[P3] Amber stacks on the current location.**
  - *Why it matters*: active stage `--surface-alt`, active day `--surface-alt` (rgb(254,243,199) in light), plus a 9px amber node with two glows. Three accent cues compete, so "which one is current" is ambiguous between stage and day, and the pale amber day block is the largest amber area on the page — against §6's "amber is an accent, not a background".
  - *Fix*: keep the node and a neutral raised row for the current day; give the stage header only the chevron plus an optional 1px neutral inset marker, not a full fill.
  - *Suggested command*: `/impeccable quieter`

### Persona Red Flags

- **Sam (keyboard / screen reader)**: opens the drawer from the hamburger and focus stays on the page body; there is no dialog name to announce, no `nav` landmark for the rail, and Tab from the drawer's last item moves to the breadcrumb *behind* the overlay. Escape leaves it open, and 35 focusables behind the dimmer remain reachable. For Sam the drawer is a visual illusion.
- **Alex (power user)**: the rail has no typeahead, no collapse-all, no "jump to current", and no Escape-to-close. His fast path is `Ctrl K` in the navbar, so he stops using the rail entirely — the primary navigation becomes decoration.
- **Casey (mobile, one-handed)**: a 320px drawer on a 390px screen leaves a 70px dimmed strip; the 28×28 close button sits at the top-right, outside the thumb zone; expanding S1 and S4 turns the drawer into a multi-screen scroll of three-line task strings.

### Minor Observations

- `select-none` on the rail body prevents selecting or copying a day title.
- Stage toggles expose `aria-expanded` but no `aria-controls`; the day list is loose links, not a `ul`, so screen readers get no group count.
- `title` duplicates the visible label, never appears on touch, and competes with the row's own text on desktop.
- There is no Overview/Home row; the logo is the only way back to the index.
- The node's 9px dot is centred on the rail at `left: 0`, so it half-hangs outside the highlighted row.
- Overlay hints: the scroll area shows no top/bottom fade, so a 16-day stage will look cut off rather than scrollable.
- The day-number contrast differs sharply by theme (5.0:1 light vs 12.1:1 dark), so the same element reads as a different rank in each theme.

### Questions to Consider

- What if each stage showed its own progress ("2 / 6 demos") instead of a publishing disclaimer?
- What if a collapsed stage still showed its current day number, so collapsing could never hide you?
- Does a 320px persistent rail earn its space at 1024px, or should it become a 72px icon rail that expands on hover or focus?

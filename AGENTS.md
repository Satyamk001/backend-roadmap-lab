Read this file fully before you change UI, engines or content. If a task conflicts with it, stop and ask.

1. What this project is

Backend Roadmap Lab turns my Notion backend-roadmap notes into small interactive demos, grouped by Stage and Day. A learner should understand one concept per demo within a minute, without reading anything first.

Audience: backend engineers and interview candidates (distributed systems, queues, caching, concurrency).
Language: explanations and the "What just happened?" line are Hinglish (Hindi in Roman script + English technical terms), short sentences, matching the notes. Code, comments, docs and commit messages are English.
No real Kafka, RabbitMQ or Redis. Every demo is a deterministic in-browser TypeScript simulation (same seed + same actions = same result).
100% static site. No Notion calls at runtime. No tokens in the repo or the browser.
2. Hard rules
Every demo teaches one idea, and its title states it ("Same key, same partition").
Every tab renders its own demo. A test enforces this (see section 9).
Never render raw markdown or Notion tags (<callout>, <mention-page>, <details>) to the learner.
The default view of a demo has 5 or fewer controls; everything else is under "More options".
Amber is an accent, not a background. Cards are neutral.
Colours come from CSS variables. No hex values in components.
No new runtime network calls, no new dependencies without asking.
npm run lint, npm run test and npm run build pass before you report done.
3. Source of truth (Notion, read-only)

Use the Notion MCP to read. Never create, edit or delete anything in Notion.

Item ID
Tracker page 3f2bcc23-fb65-8168-980a-df8a038cfcb5
Tasks database 7642d544-cde1-4748-8d80-de6ed8a47179 (verify via MCP; the data source id may differ)
Notes library root 3f2bcc23-fb65-812f-8f2b-f5176c746945

Notes pages known so far: S1 Day 1 3f6bcc23-fb65-814b-acf2-fd10e6761b79, S4 Day 22 3f9bcc23-fb65-814c-a41b-ed93a259d096, S6 Day 35 3f5bcc23-fb65-8120-8eeb-c9eb79a5dde1, Day 37 3f5bcc23-fb65-8135-ad28-c463aa2cd48b, Day 38 3ffbcc23-fb65-81dd-92f1-d70d2a1739ca. New days: discover them by walking the library, and add their ids to meta.json, not to this file.

Snapshot layout (committed to git):

content/stages/<stage-slug>/stage.json
content/stages/<stage-slug>/day-XX/meta.json
content/stages/<stage-slug>/day-XX/notes.md      # raw snapshot, for agents only

meta.json fields: dayNumber, title, stageId, trackerTask, definition, keyPoints[{icon,title,description}], recap, concepts[], demos[{id,title,summary,difficulty,notesAnchor}], notesUrl, notionPageId, lastSynced, status.

definition is a single crisp sentence answering "What is this topic fundamentally?" without a jargon wall.
keyPoints is an array of exactly 3 scannable takeaway points ({icon, title, description}) answering what 3 core backend engineering problems today solves.
recap is a hand-written 2 to 3 sentence Hinglish narrative summary. It is rendered inside a collapsed "Read detailed narrative recap" toggle in the header, preserving deep context without cluttering or pushing down the demo viewport.
Build demos from what the notes actually say, using their terms and example data. Do not invent concepts. If unclear, choose the simplest reading and add TODO(notes).
Navigation is generated from content/. Never hardcode nav links. Add a day with npm run new-day -- --stage s6 --day 39 --title "...".
4. How a demo teaches
Order demos as a story that builds on the previous one (e.g. Kafka: producer, topic and partitions, then consumers and groups, then offsets and lag, then rebalance, then acks and replication, then retries and DLQ). Merge or cut demos that add no new idea.
"What just happened?" is the most important element. One Hinglish sentence under the demo title, updated after every action, plus one smaller "why it matters" line.
Show state on the objects: offsets on message cells, lag on the consumer lane, owner on the partition. No numbers hidden in side panels.
Colour carries meaning and is never the only signal (add a label, icon or shape).
Empty states say what to click ("Pehla message bhejo").
Direct manipulation over sliders. Buttons are labelled with verbs: "Send message", "Add consumer", "Crash consumer".
Auto-play is a single toggle, off by default. The demo must be fully usable by clicking.
5. Demo chrome

Default view (visible):

The "What just happened?" line.
The demo canvas (the largest element on the page).
Up to 5 primary action buttons.
A short event log (collapsed on mobile).

Under a collapsed "More options" row: Play/Pause/Step, speed, seed + randomise, scenario presets, state inspector, challenges.

Rules for the extras:

Challenges: 2 or 3 per demo, with automatic pass/fail. No challenge counter in the page header.
Event log: timestamped by virtual tick, aria-live="polite", at most 100 lines in the DOM, clicking a line highlights its element.
State inspector: collapsible JSON of the engine snapshot.
6. Design system

Amber is the accent for primary buttons, active tab, focus ring, links and the status-line left border. Everything else is neutral.

Token Light Dark
--bg

# FFFBEB

# 0F0D0A

--surface

# FFFFFF

# 1C1917

--surface-alt

# FEF3C7

# 292524

--border

# FDE68A

# 44403C

--text

# 1C1917

# FAFAF9

--text-muted

# 57534E

# A8A29E

--primary (fill, dark text on it)

# F59E0B

# FBBF24

--accent (text and links)

# B45309

# FCD34D

Rules:

Define tokens on :root and :root[data-theme="dark"] and map them in Tailwind. Do not scatter hex in components.
Theme options: Light, Dark, System (default). Persist in localStorage. Resolve the theme with a synchronous inline script in index.html before first paint (no flash).
Amber

# F59E0B or

# FBBF24 is a fill with dark text. Never use it as text on light backgrounds. Verify AA contrast in both themes

Amber is the brand, so it never means "warning". Semantic states (each also gets an icon or label):
success / processed: emerald
error / lost message: red
duplicate: violet
in-flight message: amber (the one allowed exception, always with an arrow or motion cue)
neutral: stone
info: sky
Entity palette (partitions, consumers, brokers, workers), always paired with a label such as P0, C1, B2: sky, emerald, violet, rose, indigo, teal. Do not use amber or orange for entities.
Typography: system sans (or Inter) for headings, labels and body, 15 to 16px minimum, sentence case. Monospace only for data (keys, offsets, hashes, payloads, logs). No uppercase micro-labels, no all-monospace UI.
Light theme: soft shadows. Dark theme: 1px borders, no shadows. Focus ring: 3px amber outline. Respect prefers-reduced-motion.
7. Layout

7. Layout

Day page layout, top to bottom:
1. Breadcrumbs (Roadmap > Stage > Day).
2. DayHeader: Day title, the 1-line Core Mental Model definition box, 3 scannable key takeaway cards (in a 3-column grid on desktop, 1-column on mobile), and the collapsible "Read detailed narrative recap" toggle. Never dump a 3-sentence wall of text directly at the header.
3. Story-ordered demo tab bar with keyboard shortcut badges (1-6).
4. Active interactive simulation demo canvas (the largest element on the page).
5. Collapsible "Read the notes (Notion study snapshot)" drawer at the bottom: formatted clean Web UI rendered via NotionNotesRenderer (HTML tables converted to responsive <table> with horizontal scroll, callouts with icons, details/summary accordions, code blocks with copy button). Never show raw Notion or HTML tags like <table>, <tr>, <td>, <callout>, <details>, <mention-page>.

One content column, max width about 1000px, 16 to 24px between blocks.
Sidebar: Stage > Day only, sorted by stage then day, collapsed except the current stage. Demos are listed on the day page, not in the sidebar.
Mobile (390px): sidebar becomes a menu button, demo stacks vertically, no horizontal page scroll (message lanes may scroll inside their own container). Support 360px up to 1440px.
Accessibility: fully keyboard operable, visible focus, aria-live for the status line, labels on every icon button.
8. Simulation engines
Pure TypeScript in src/engine/<topic>/. No React, DOM or CSS in engines.
Deterministic state machine with a virtual tick clock and a seedable PRNG.
The UI dispatches actions (produce, step, crashConsumer) and receives immutable snapshots plus typed events. The UI never mutates engine state.
Demos are lazy-loaded through src/demos/registry.ts with React.lazy.
9. Testing and definition of done
Vitest unit tests for every engine algorithm (murmur2 partitioner, assignors, rebalance state machine, ISR and high watermark, commit and delivery semantics, backoff and DLQ). At least one test per documented failure mode.
Registry test: for every demo in every meta.json, the rendered demo's title equals the tab title and the demo exists in the registry.
Content test: no rendered page contains <callout, <mention-page or <details.
UI changes: open the page at 1440px and 390px in light and dark theme, take screenshots, and compare against the previous version. List what you changed and why.
Report with this checklist, each item verified:
 every tab shows its own demo
 no raw markdown or Notion tags on the page
 header has 1-line definition and 3 scannable takeaway cards; recap is collapsible
 default demo view has 5 or fewer controls and one "What just happened?" line
 amber is used only as accent; cards are neutral in both themes
 body text is 15px or larger; monospace only for data
 no horizontal page scroll at 390px; AA contrast in both themes
 lint, test and build pass
10. Workflow
Check the task against this file.
For a new day: sync its notes into content/, write definition, 3 keyPoints, recap, and the demo list (one idea each, in teaching order), and show me the list before building.
Build one demo first, review it with screenshots, then build the rest.
Work in small steps and ask before adding dependencies or changing this file.

Commands: npm run dev, build, preview, test, lint, new-day.

 1. Do not
Dump dense 3-sentence text paragraphs at the page header instead of the 1-line definition and 3 key takeaway cards.
Show raw Notion markup, long note excerpts or placeholder copy to learners.
Render raw HTML table tags (<table>, <tr>, <td>) or unparsed Notion tags in the notes drawer.
Put Seed, Preset, Speed, timers or challenge counters above the demo by default.
Fill every card with amber, or use amber as warning, as entity colour, or as text on light backgrounds.
Hardcode nav entries, Notion URLs in components, or hex colours.
Add one demo that teaches several ideas.

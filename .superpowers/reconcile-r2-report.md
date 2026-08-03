# Reconcile R2: stylesheet merge report

Date: 2026-08-02
Deliverables written: `/home/stan/stanleyjacob.dev/style.css` (1983 lines), `/home/stan/stanleyjacob.dev/theme.js`, `/home/stan/stanleyjacob.dev/scripts/contrast.mjs`.

## Structure of the merged file

1. OURS (warm editorial, 570 lines) verbatim as the foundation, with one insertion: the `:root[data-theme="dark"]` token block placed directly after the `.hue-*` utilities (nothing from OURS was deleted or reordered otherwise). The `pre.shl` semantic code-block section is byte-identical to OURS.
2. Ported sections appended under a single "PORTED SECTIONS" banner, in this order: classes/coursework extras, redesigned featured-article card + reader float/scrubber + diagram remaps, difficulty-label retirement, direct-child whole-row click-through, nav theme toggle, HERO SHIP SCENE, AlgViz, PORTFOLIO CASE-STUDY SYSTEM (incl. `.section-head .kicker`), C++ field guide, and finally a "DARK THEME ADAPTATION" block that wins the cascade.

## Theme polarity

- Bare `:root` = warm light (unchanged OURS tokens). `:root[data-theme="dark"]` = the specified warm-dark palette, adopted exactly as given; no lightness adjustments were needed (all 55 dark pairs pass AA as specified, most with >5:1 headroom).
- Hue RGB triplets (`--teal/--sage/--gold/--plum/--terra`) are shared by both themes; only the `*-text` hexes flip.
- `theme.js` rewritten for flipped polarity: no attribute = light; toggling dark sets `data-theme="dark"`, toggling light removes the attribute; both store `localStorage("theme")`. The icon shows the theme you would switch TO and is refreshed on load and on click. Verified live: null -> click -> `dark`/stored "dark" -> click -> attribute removed/stored "light". The existing inline head bootstrap on all 320 pages works unmodified (a stored "light" sets `data-theme="light"`, which no CSS targets, i.e. renders as default light; `current()` treats anything but "dark" as light).

## Section-by-section porting decisions and color mappings

- **classes/coursework extras** (`.jump`, `.pending`, `.problem`, KaTeX, `.tbl-wrap`, `table.data`): layout verbatim. `#fff` chips -> `var(--bg-card)`; `.jump a` set in `var(--sans)`; `.plabel` restyled as a tracked uppercase Chakra Petch label (11.5px / 500 / .08em) matching `.cell .k`.
- **THEME ADAPTATION (theirs)** re-derived for flipped polarity. Most of their block re-pointed hard-coded `#fff`/light tints at their card tokens; OURS is already fully token-driven, so those repoints are unnecessary and were NOT carried (carrying them would have overwritten OURS component styling; see "not ported" below). What dark mode actually still needs now lives in the final `[data-theme="dark"]` block: quiz-key labels, active filter buttons, the AlgViz play button and `::highlight(reader-word)` flip from white to ink (the dark accent `#E8814B` is too light for white text, 2.6:1); the `.syschip.active` no-category fallback gets solid `#AF3A03` (the fixed category hexes are dark in both themes, so white stays correct on them); the featured-window hover scrim goes fully black; mermaid HTML labels are pinned to ink pre-filter (see below).
- **Redesigned featured-article card**: structure, gradient wash, left rule, hover lift kept. `--accent-weak` -> `rgba(var(--terra), 0.06)`; `--card` -> `var(--bg-card)`; both glow box-shadows -> `none` (quiet-border system); `.k` moved to the label stack in accent.
- **Reader extras**: `.reader-float` (+row/range/pos/jump) ported on `var(--bg-card)` + hairline border, shadow dropped. `::highlight(reader-sentence)` -> `rgba(var(--gold), 0.38)` + `var(--text)` (translucent so it composites on both themes); `::highlight(reader-word)` -> solid accent with white (light) / ink (dark).
- **Diagram attribute remaps**: all `[fill=]`/`[stroke=]` rules kept; targets translated: `#1d1d1f`->text, `#5f5f66`->muted, `#86868b`->muted-2, `#f6f6f7`->bg-soft, `#fff(fff)`->bg-card, `#eaf2fb`->`rgba(terra,.09)`, `#0066cc`->accent, good/bad/warn hexes->sage/terra/gold-text, `#eef8f1`->`rgba(sage,.12)`, `#fbeaea/#fdeaea`->`rgba(terra,.08)`, `#fff8d6`->`rgba(gold,.10)`, `#d8d8de`->line, `#f2c200`->`rgb(var(--gold))`. Verified on /systems: warm ink + terracotta in light, dark cards + light text in dark.
- **`svg.flowchart` filter**: polarity flipped; the `invert(0.9) hue-rotate(180deg)` filter now exists only under `[data-theme="dark"]`, default is unfiltered. **Bug found and fixed during verification**: mermaid's HTML `<p>` labels match the site's `.prose p { color: var(--text) }`, so in dark they were light BEFORE the filter and inverted back to dark (unreadable). Added `[data-theme="dark"] .diagram svg.flowchart .nodeLabel/.edgeLabel/p { color: #1d1d1f }` so the filter emits light labels. (This bug existed in THEIRS' dark-default too.)
- **Difficulty retirement + `.notes li > a` click-through**: ported verbatim (aligned with the no-LeetCase-framing direction).
- **Nav theme toggle**: restyled quiet per spec: 28px square, 1px `var(--line)` border, radius 6px, transparent bg, `var(--sans)` 13px, muted color, hover = text color + muted border; no glow, no pill. `nav.top .links { align-items: center }` added (theirs had it in the base nav rule).
- **HERO SHIP SCENE**: all structure, scrim, keyframes and reduced-motion rule verbatim. The scene palette tokens (`--sky/--sea/--hull/--sail/--aur/--star`) moved from `:root` onto `.hero-home` (content-art scope) using THEIRS' dark values; the scene stays a nocturnal Aegean under both themes (their own `.hero-scene` bg is hardcoded `#070c18` and the hero text is fixed light, so a light variant would fight the scrim). Added `border-bottom: 1px solid var(--line)` on `.hero-home` as the hairline separation from the cream page. `--scene-fade` set to the scene's own `#070c18` rather than page bg. `.hero-home .btn.link` pale blue `#cfe0ff` -> pale warm `#f2d5be`. Note: no current page uses this markup (no `.hero-home`/`#hero-ocean` in any HTML); the section is ported for when it returns.
- **AlgViz**: verbatim with `--card` -> `var(--bg-card)`; small controls annotated with `var(--sans)`; canvas art keeps its own JS-drawn palette (verified it sits well on both grounds inside the card frame); play button white icon in light, ink in dark. The stray `.hero-photo` media rule kept.
- **PORTFOLIO CASE-STUDY SYSTEM**: all grids/positioning/sizing/media queries verbatim. Mappings: hero radials `rgba(86,168,255,.17)`->`rgba(var(--terra),.10)`, `rgba(78,203,138,.09)`->`rgba(var(--sage),.08)`; ::after rings -> terra at .04/.03; `--card`->bg-card; `--good/--warn`->sage-text/gold-text (status pills, article-label); case-card hover glow shadow -> replaced with `background: var(--bg-card-hover)` (kept the -2px lift); `.project-shot`/`.evidence` shadows dropped; metric bar-fill gradient end `color-mix(accent 48%, good)` -> `color-mix(accent 48%, rgb(var(--sage)))`; eyebrow/kicker/case-number/stack-step .k/timeline time/shot-frame chip -> Chakra Petch label stack at weight 500 (Chakra ships 400/500 only; theirs used 650-780); `.status-pill`/`.article-label`/`.filter-btn`/`.metric-bar` -> `var(--sans)`. `.project-shot-frame::before` keeps its fixed dark chip (sits on a screenshot, theme-independent). `.section-head .kicker` (used by /work but only present in THEIRS' base rules) added as a tracked uppercase accent label.
- **C++ field guide**: all structure verbatim with `var(--card)`->`var(--bg-card)`. The remote tone family remapped onto the earthy system: `--cyan`->teal-text, `--emerald`->sage-text, `--amber`->gold-text, `--violet`->plum-text, `--cobalt`->terra-text (page tone = site accent family), `--coral`-> literal brick `#A03A32` light / `#D98B7E` dark (the hue family has five slots for six tones; coral kept a distinct warm-red so the chapter grid tones stay distinguishable). Because five of six tones reference `*-text` tokens, they flip with the theme automatically, which replaces THEIRS' `[data-theme="light"] body.cpp-guide-page` override block. Labels/pills -> Chakra Petch at 500.

## Not ported faithfully (explicit list)

- THEIRS base-design rules that OURS supersedes by design (sans body stack, 15px scale, blue accent `#56a8ff`/`#0066cc`, `--nav-bg`/`--shadow`/`--card`/`--card-2`/`--accent-weak`/`--good`/`--warn`/`--bad`/`--ok-*`/`--bad-*`/`--mark-*`/`--take-*` token definitions, solid-fill `.btn.primary`, traffic-light window dots, pill tags, pulse keyframes): not carried; OURS wins per the merge contract. Their semantic roles are covered by OURS tokens (sage/gold/terra text hexes, gold tints for mark/takeaway).
- THEIRS THEME ADAPTATION re-points of `.reader-bar/.reader-note/.reader-stop/.reader-reading`, `.window/.tag/.proj/.cell/.code-tabs` backgrounds, badge/diff/mark/takeaway/quiz recolors: dropped as redundant; OURS styles these from tokens already, and carrying them would have destroyed OURS' terra reader pill and hue-chip design. The one behavioral piece they contained that OURS lacked (white-on-solid fixes for dark) is re-derived in the new dark adaptation block.
- Ship scene light-theme palette variants (light sky/sea/hull/sail values under their `[data-theme="light"]`): intentionally dropped; the scene is kept as theme-independent dark content-art (their own fixed-light hero text and hardcoded dark scene background assume it), with a hairline frame for the cream page. Listed here so it is not a silent drop.
- Their reduced-motion comment claimed the drift was kept while the rule disabled everything; the rule was kept, the contradictory comment rewritten.
- Their `box-shadow` treatments throughout (window, proj hover, article-card glow, case-card, evidence, reader-float, project-shot): replaced with hairline borders / hover surface shifts per the no-shadow design language. Layout/geometry untouched.
- Weights 650/680/700-780 on Chakra-labeled elements normalized to 500 (heaviest shipped @font-face); sans elements keep 600/700.

## Dark palette adjustments for AA

None required. The provided dark values pass every pair as-is (closest margins: accent on `--bg-card-hover` 5.32:1, terra-chip 5.00:1, muted-2 on hover 5.38:1). The only "adjustment" in this area is behavioral, not tonal: dark mode pairs ink (`var(--bg)`) instead of white with solid-accent/solid-hue surfaces (quiz keys, filter buttons, AlgViz play, reader word highlight), since white on `#E8814B` is 2.6:1. The checker's on-solid pairs use white for light and `#211B14` for dark accordingly ("where used" semantics).

## Checker output (final)

```
light: 55/55 pairs pass WCAG AA 4.5:1
dark: 55/55 pairs pass WCAG AA 4.5:1
OK: both themes pass
```
Exit code 0; exits non-zero on any missing token (light asserted against `:root` scope, dark against the `[data-theme="dark"]` block, line/line-soft included) or any failing pair.

## Screenshot observations (Playwright, cache-busted `?v=merge`)

- Homepage light + dark (full page): portfolio hero with warm radial tints and ring ornament, signal grid, case cards, sage/gold/terra status pills, ink-on-orange active states in dark; no stark-white panels, no blue remnants. Tracklet demo window and its dark iframe unchanged.
- /work light + dark: kicker labels in tracked Chakra caps, filter chips (active = solid terracotta/white in light, orange/ink in dark), stack-map arrows, evidence and blueprint cards all read correctly.
- /software/cpp light + dark: glance cards and the five-card standards ladder render in teal/sage/terra/plum/gold with correct tone flips in dark; version pills in Chakra; dark `pre.shl` blocks visually identical in both themes.
- /software/fpga/pipelining light + dark: serif article, KaTeX display math, terracotta h2 rules, SystemVerilog `pre.shl` block identical.
- /systems light + dark: hand-drawn SVG kit-of-parts diagram fully remapped (cream/dark cards, terracotta accent stroke); search + category chips correct in both themes.
- /algorithms/two-pointers light + dark: AlgViz card, controls, and code tabs correct in both themes.
- /robotics/projects/robot-imitation-lab dark: mermaid flowchart initially unreadable (see bug above); after the label-pinning fix, dark boxes with light labels; light mode unfiltered and correct.
- Toggle button: quiet 28px hairline square with moon/sun icon, sits before the GitHub link; click-cycle verified in both directions including localStorage.

Screenshots saved to the session scratchpad (`home-light/dark`, `work-light/dark`, `cpp-light-ladder2`, `cpp-dark-ladder`, `fpga-light/dark`, `systems-light/dark`, `algviz-light/dark`, `flowchart-dark(-fixed)`).

## Hygiene

- `grep -c "—" style.css theme.js` = 0 for both (and for scripts/contrast.mjs).
- Braces balanced (619/619); no merge-conflict markers remain in style.css.
- Local server killed after verification. Nothing committed or staged.

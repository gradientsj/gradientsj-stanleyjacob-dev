# Soft Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle stanleyjacob.dev site-wide from the Apple-flavored white/blue look to the approved warm editorial design (spec: `docs/superpowers/specs/2026-08-02-soft-redesign-design.md`), and replace the homepage hero/About copy with the spec's softened text.

**Architecture:** The site is static HTML with one shared `style.css` and no build step, so almost everything lands in `style.css` (tokens, typography, component restyles) plus `index.html` (copy and structure), one JS palette swap (`systems-filter.js`), and two self-hosted font files. A small `scripts/contrast.mjs` checker makes the palette work test-driven.

**Tech Stack:** Plain CSS/HTML/JS. Node (already used in `scripts/`) for the contrast checker. No new dependencies.

## Global Constraints

- No em dashes anywhere in new copy or comments: `grep -rn "—" --include="*.html" .` must return nothing (already true today).
- No AI-tell phrasing in any copy you write: banned strings (case-insensitive): "isn't just", "not just", "delve", "seamless", "leverage", "robust" (in prose), "crucial", "comprehensive", "the point is", "the range follows".
- Color never touches headings or body text: hues appear only in links, chips, micro-labels, small markers, and feedback states.
- Every text/background pair must pass WCAG AA 4.5:1, including text on tinted chips composited over every background it can sit on. `node scripts/contrast.mjs` enforces this.
- No external requests introduced: fonts are self-hosted under `/fonts/`.
- Do NOT touch the semantic code palette (`pre.shl` rules, `style.css:503-519`), do NOT run `scripts/highlight.mjs`.
- Font stacks (exact): serif `'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif`; sans `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`; labels `'Chakra Petch'` then the sans stack.
- Commit messages: plain imperative sentence (repo style, e.g. "Replace runtime highlight.js with build-time semantic highlighting"), ending with the line `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Work on branch `soft-redesign` off `main`. Do not push.

---

### Task 1: Palette tokens, hue utilities, and base typography

**Files:**
- Create: `scripts/contrast.mjs`
- Modify: `style.css:1-92` (header comment, `:root`, body, links, wrap, nav, hero, buttons, sections), `style.css:149-196` (tags, proj cards, prose, grid/cell, notes), `style.css:217-231` (footer, media query)

**Interfaces:**
- Produces (all later tasks rely on these exact names): CSS custom properties `--bg #FAF6F0`, `--bg-soft #F2EDE4`, `--bg-card #FCF9F4`, `--bg-card-hover #F5EEE1`, `--text #2B2621`, `--muted #6F675C`, `--muted-2 #756D60`, `--line #E5DECF`, `--line-soft #EDE7DA`, `--accent #AF3A03`, `--accent-press #9A3403`, `--radius 8px`, `--serif`, `--sans`, `--label`; RGB triplets `--teal 66,123,88`, `--sage 104,157,106`, `--gold 181,118,20`, `--plum 143,63,113`, `--terra 175,58,3`; text-safe hexes `--teal-text #35624A`, `--sage-text #43684A`, `--gold-text #8A5A0F`, `--plum-text #8F3F71`, `--terra-text #9A3403`; hue utility classes `.hue-teal .hue-sage .hue-gold .hue-plum .hue-terra`, each setting `--h` (triplet) and `--ht` (text-safe hex).

- [ ] **Step 0: Create the working branch**

Run: `cd ~/stanleyjacob.dev && git switch -c soft-redesign`
Expected: `Switched to a new branch 'soft-redesign'`

- [ ] **Step 1: Write the failing contrast checker**

Create `scripts/contrast.mjs` (plain Node, no deps):

```js
// WCAG AA checker for the soft-redesign palette. Reads style.css, asserts the
// new tokens exist, then checks every text/background pair the design uses,
// compositing tinted chip backgrounds over each surface they can sit on.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../style.css", import.meta.url), "utf8");

const TOKENS = {
  bg: "#FAF6F0", bgSoft: "#F2EDE4", bgCard: "#FCF9F4", bgCardHover: "#F5EEE1",
  text: "#2B2621", muted: "#6F675C", muted2: "#756D60",
  accent: "#AF3A03", accentPress: "#9A3403",
  tealText: "#35624A", sageText: "#43684A", goldText: "#8A5A0F",
  plumText: "#8F3F71", terraText: "#9A3403",
};
const TINTS = {
  teal: "#427B58", sage: "#689D6A", gold: "#B57614",
  plum: "#8F3F71", terra: "#AF3A03",
};

let failures = 0;
for (const [name, hex] of Object.entries(TOKENS)) {
  if (!css.toUpperCase().includes(hex)) {
    console.error(`MISSING token ${name} ${hex} in style.css`);
    failures++;
  }
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(rgb(a)), lum(rgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (fg, base, alpha) => {
  const f = rgb(fg), b = rgb(base);
  return "#" + f.map((c, i) => Math.round(alpha * c + (1 - alpha) * b[i])
    .toString(16).padStart(2, "0")).join("");
};

const surfaces = [TOKENS.bg, TOKENS.bgSoft, TOKENS.bgCard, TOKENS.bgCardHover];
const pairs = [];
for (const s of surfaces) {
  pairs.push(["text", TOKENS.text, s], ["muted", TOKENS.muted, s],
    ["accent", TOKENS.accent, s], ["accentPress", TOKENS.accentPress, s]);
}
pairs.push(["muted2/meta", TOKENS.muted2, TOKENS.bg]);
// hue text on its own 9% chip tint composited over every surface
for (const [hue, tint] of Object.entries(TINTS)) {
  const text = TOKENS[hue + "Text"];
  for (const s of surfaces) pairs.push([`${hue}-chip`, text, over(tint, s, 0.09)]);
}
// feedback states (quiz): text-safe on 12% tint over card bg; white on solid text-safe
pairs.push(["quiz-ok", TOKENS.sageText, over(TINTS.sage, TOKENS.bgCard, 0.12)]);
pairs.push(["quiz-no", TOKENS.terraText, over(TINTS.terra, TOKENS.bgCard, 0.08)]);
for (const k of ["tealText", "sageText", "goldText", "plumText", "terraText"]) {
  pairs.push([`white-on-${k}`, "#FFFFFF", TOKENS[k]]);
}
// primary button label on its tint at rest and hover, on both page surfaces
for (const a of [0.08, 0.14]) for (const s of [TOKENS.bg, TOKENS.bgSoft]) {
  pairs.push([`btn@${a}`, TOKENS.accentPress, over(TINTS.terra, s, a)]);
}

for (const [name, fg, bgc] of pairs) {
  const r = ratio(fg, bgc);
  if (r < 4.5) {
    console.error(`FAIL ${name}: ${fg} on ${bgc} = ${r.toFixed(2)}:1`);
    failures++;
  }
}
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log(`OK: ${pairs.length} pairs pass WCAG AA 4.5:1`);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd ~/stanleyjacob.dev && node scripts/contrast.mjs`
Expected: FAIL with "MISSING token" lines (old palette still in place), exit 1.

- [ ] **Step 3: Replace the tokens and add hue utilities**

In `style.css`, replace the whole `:root` block (lines 6-17) with:

```css
:root {
  --bg: #FAF6F0;
  --bg-soft: #F2EDE4;
  --bg-card: #FCF9F4;
  --bg-card-hover: #F5EEE1;
  --text: #2B2621;
  --muted: #6F675C;
  --muted-2: #756D60;
  --line: #E5DECF;
  --line-soft: #EDE7DA;
  --accent: #AF3A03;
  --accent-press: #9A3403;
  --radius: 8px;
  --serif: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
  --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
    Arial, sans-serif;
  --label: 'Chakra Petch', -apple-system, BlinkMacSystemFont, 'Segoe UI',
    Roboto, Helvetica, Arial, sans-serif;
  --teal: 66, 123, 88;
  --sage: 104, 157, 106;
  --gold: 181, 118, 20;
  --plum: 143, 63, 113;
  --terra: 175, 58, 3;
  --teal-text: #35624A;
  --sage-text: #43684A;
  --gold-text: #8A5A0F;
  --plum-text: #8F3F71;
  --terra-text: #9A3403;
}
.hue-teal  { --h: var(--teal);  --ht: var(--teal-text); }
.hue-sage  { --h: var(--sage);  --ht: var(--sage-text); }
.hue-gold  { --h: var(--gold);  --ht: var(--gold-text); }
.hue-plum  { --h: var(--plum);  --ht: var(--plum-text); }
.hue-terra { --h: var(--terra); --ht: var(--terra-text); }
```

Update the file header comment (lines 1-4) to read "warm editorial register, serif prose, hue-keyed labels" instead of the old description.

- [ ] **Step 4: Base typography and register**

Apply these edits (exact rules; keep any property not mentioned):

```css
body {
  margin: 0; background: var(--bg); color: var(--text);
  font-family: var(--serif);
  font-size: 16.5px; line-height: 1.65;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}

a { color: var(--accent); text-decoration: none; }
.prose a, .article a, .section-head a, .notes a {
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--accent) 35%, transparent);
  transition: color 0.2s ease, text-decoration-color 0.2s ease;
}
a:hover { text-decoration: underline; color: var(--accent-press);
  text-decoration-color: var(--accent-press); }

nav.top {
  position: sticky; top: 0; z-index: 20;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: saturate(140%) blur(14px);
  border-bottom: 1px solid var(--line-soft);
}
nav.top .inner { height: 52px; /* rest unchanged */ }
nav.top .brand a {
  font-family: var(--label); font-size: 13px; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.08em; color: var(--text);
}
nav.top .links a { color: var(--muted); font-size: 13.5px; font-family: var(--sans); }

.hero { padding: 56px 0 36px; }
.hero .lead { font-size: 18px; line-height: 1.65; max-width: 680px; }

.btn { font-family: var(--sans); font-size: 14px; font-weight: 500;
  padding: 9px 16px; border-radius: 6px; border: 1px solid transparent; }
.btn.primary {
  background: rgba(var(--terra), 0.08); color: var(--accent-press);
  border-color: rgba(var(--terra), 0.35);
}
.btn.primary:hover { background: rgba(var(--terra), 0.14); text-decoration: none; }

section { padding: 60px 0; }
.section-head p { color: var(--muted); font-size: 16px; max-width: 680px; }

.tag {
  font-family: var(--sans); font-size: 12px; font-weight: 500;
  color: var(--ht, var(--muted));
  background: rgba(var(--h, 111, 103, 92), 0.09);
  border: 1px solid rgba(var(--h, 111, 103, 92), 0.2);
  border-radius: 4px; padding: 3px 9px;
}

.proj { background: var(--bg-card); border: 1px solid var(--line);
  border-radius: var(--radius); /* rest unchanged */ }
a.proj:hover { border-color: var(--line); background: var(--bg-card-hover); }
a.proj h3 { color: var(--text); }
.cell { background: var(--bg-card); border: 1px solid var(--line); }
.cell .k {
  font-family: var(--label); font-size: 11.5px; font-weight: 500;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--ht, var(--muted));
}

.prose p { font-size: 16px; line-height: 1.65; }
footer.site, .notes .date, .meta { font-family: var(--sans); }

/* editorial measure: running text narrows to about 680px while tables,
   code blocks, figures, and diagrams keep the full 860px column */
.prose p, .prose li, .article p, .article li { max-width: 700px; }
.article ul, .article ol { max-width: 700px; }
```

(Visual QA in Task 6 must confirm no article table or code block got squeezed; those elements intentionally keep the wide column.)

Also: delete `.section-head .kicker` rule (line 90); in the 740px media query change `section { padding: 40px 0; }`.

- [ ] **Step 5: Run the checker and eyeball the result**

Run: `node scripts/contrast.mjs`
Expected: `OK: ... pairs pass WCAG AA 4.5:1`

Run: `cd ~/stanleyjacob.dev && python3 -m http.server 8080 &` then screenshot `http://localhost:8080/` with the Playwright browser tools (1280px and 390px wide). Expected: cream page, serif prose, terracotta links, no blue anywhere above the fold. Note: chips are neutral until Task 5 adds hue classes; other pages will look half-migrated until Tasks 3-4. Kill the server after.

- [ ] **Step 6: Commit**

```bash
git add style.css scripts/contrast.mjs
git commit -m "Swap the palette to warm cream and terracotta with serif prose and hue tokens

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Self-hosted Chakra Petch

**Files:**
- Create: `fonts/chakra-petch-400.woff2`, `fonts/chakra-petch-500.woff2`
- Modify: `style.css` (add `@font-face` at top, after the header comment)

**Interfaces:**
- Consumes: `--label` from Task 1 (already references 'Chakra Petch' with sans fallback).
- Produces: the two font files at `/fonts/`; nothing else depends on names beyond the family string 'Chakra Petch'.

- [ ] **Step 1: Download the latin subset woff2 files (OFL-licensed)**

```bash
cd ~/stanleyjacob.dev && mkdir -p fonts
curl -sL "https://gwfh.mranftl.com/api/fonts/chakra-petch?download=zip&subsets=latin&variants=regular,500&formats=woff2" -o /tmp/claude-1000/-home-stan/4237b752-fdc0-4660-9ce5-67b6b3412581/scratchpad/chakra.zip
unzip -o /tmp/claude-1000/-home-stan/4237b752-fdc0-4660-9ce5-67b6b3412581/scratchpad/chakra.zip -d /tmp/claude-1000/-home-stan/4237b752-fdc0-4660-9ce5-67b6b3412581/scratchpad/chakra
cp /tmp/claude-1000/-home-stan/4237b752-fdc0-4660-9ce5-67b6b3412581/scratchpad/chakra/*regular*.woff2 fonts/chakra-petch-400.woff2
cp /tmp/claude-1000/-home-stan/4237b752-fdc0-4660-9ce5-67b6b3412581/scratchpad/chakra/*500*.woff2 fonts/chakra-petch-500.woff2
```

Fallback if that host is down: request `https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500&display=swap` with `curl -A "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36"`, then curl the two `fonts.gstatic.com/.../*.woff2` URLs (latin block) it returns.

Verify: `file fonts/*.woff2` reports "Web Open Font Format (Version 2)"; each file is roughly 10-40 KB.

- [ ] **Step 2: Add @font-face**

Insert directly after the `style.css` header comment:

```css
@font-face {
  font-family: 'Chakra Petch';
  src: url('/fonts/chakra-petch-400.woff2') format('woff2');
  font-weight: 400; font-style: normal; font-display: swap;
}
@font-face {
  font-family: 'Chakra Petch';
  src: url('/fonts/chakra-petch-500.woff2') format('woff2');
  font-weight: 500; font-style: normal; font-display: swap;
}
```

- [ ] **Step 3: Verify it loads locally**

Serve (`python3 -m http.server 8080`), open `http://localhost:8080/` in the Playwright browser, screenshot the nav. Expected: the "STANLEY JACOB" brand renders in Chakra Petch (squarish, technical letterforms, clearly not Helvetica). Also confirm via browser network requests that both woff2 files load with 200 from localhost and no request leaves localhost. Kill the server.

- [ ] **Step 4: Commit**

```bash
git add fonts/ style.css
git commit -m "Self-host Chakra Petch for the brand and tracked labels

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Recolor and quiet every component in style.css

**Files:**
- Modify: `style.css` (feature card, badge, window, learning aids, code tabs, difficulty labels, win/warn, quiz, qa, reader, sysfilter CSS, article card, figures, article h2)

**Interfaces:**
- Consumes: every token and triplet from Task 1, exact names as listed there.
- Produces: nothing new; after this task `style.css` contains no hex from the "old" column below.

- [ ] **Step 1: Apply the mechanical color swaps**

Replace every occurrence (old → new). Do them with individual edits, not blind sed, because several lines also change structurally in Step 2:

| Old | New | Where |
|---|---|---|
| `#1d8a4e` | `var(--sage-text)` | badge, diff-easy, win, quiz/qa correct states |
| `#1db954` | `rgb(var(--sage))` | badge pulse dot |
| `#eaf7ef`, `#eef8f1` | `rgba(var(--sage), 0.12)` | quiz/qa correct backgrounds |
| `#186c3d` | `var(--sage-text)` | quiz-fb.ok text |
| `#b4232a`, `#b3261e` | `var(--terra-text)` | wrong states, diff-hard, warn |
| `#fbecec` | `rgba(var(--terra), 0.08)` | wrong backgrounds |
| `#8f1c22` | `var(--terra-text)` | quiz-fb.no text |
| `#8a6d1d` | `var(--gold-text)` | badge.wip, takeaway strong, diff-medium |
| `#d9a521` | `rgb(var(--gold))` | badge .sdot |
| `#fff3a3`, `#fff3bf` | `rgba(var(--gold), 0.22)` | mark highlights, reader-reading |
| `#fff8d6` | `rgba(var(--gold), 0.08)` | takeaway background |
| `#f2c200` | `rgb(var(--gold))` | takeaway border |
| `#f7fafe` | `var(--bg-card-hover)` | quiz-opt hover |
| `background: #fff` / `background: #ffffff` | `background: var(--bg-card)` | cell pre, code-tab buttons, article-card, figure img, window, addr |
| `#b9b9bf` | `var(--line)` | feature-card stretch hover border |
| `#fff4e8` | `rgba(var(--terra), 0.06)` | reader bar bg |
| `#ffe2c2` | `rgba(var(--terra), 0.2)` | reader bar border |
| `#ffab5e` | `rgba(var(--terra), 0.12)` | reader button bg |
| `#ff9633` | `rgba(var(--terra), 0.2)` | reader button hover/playing |
| `#4a2a00`, `#8a5216` | `var(--terra-text)` | reader button/stop text |
| `rgba(255, 255, 255, .7)` | `var(--bg-card)` | reader stop bg |

Leave untouched: everything from `/* ===== semantic code blocks` (line 454) down, the `.window .frame-holder`/iframe `#0b0e14` backgrounds, and the `.dot.r/.y/.g` traffic light hexes (deleted next step).

- [ ] **Step 2: Structural quieting**

```css
/* badge: keep the dot, kill the animation */
.badge .pulse { width: 7px; height: 7px; border-radius: 50%;
  background: rgb(var(--sage)); }
/* delete the box-shadow line, the animation line, and the whole @keyframes pulse block */

/* window: flatten the chrome */
.window { border-radius: 10px; overflow: hidden; background: var(--bg-card);
  border: 1px solid var(--line); box-shadow: none; }
.window .dot { display: none; }
.window .bar { padding: 8px 12px; background: var(--bg-card);
  border-bottom: 1px solid var(--line-soft); }
.window .addr { margin: 0; text-align: left; font-family: ui-monospace,
  SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px;
  color: var(--muted); background: none; border: none; padding: 0; }
.window .open-overlay { background: linear-gradient(to top,
  rgba(43, 38, 33, 0.35), transparent 42%); }

/* feature card hover: border only, no shadow */
.feature-card:has(.stretch:hover) { border-color: var(--line); box-shadow: none; }

/* article headings: terracotta rule marker */
.article h2 { border-left: 3px solid var(--accent); padding-left: 12px; }

/* quiz check button matches the quiet primary treatment */
.quiz-check { border: 1px solid rgba(var(--terra), 0.35);
  background: rgba(var(--terra), 0.08); color: var(--accent-press);
  font-family: var(--sans); }
/* correct/wrong keys keep white text on solid text-safe hues */
.quiz-opt.is-correct .quiz-key { background: var(--sage-text); color: #fff; }
.quiz-opt.is-wrong .quiz-key { background: var(--terra-text); color: #fff; }

/* reader button: drop the glossy shadow */
.reader-btn { box-shadow: none; }

/* sysfilter active chips get white text on the (dark) category color */
.syschip.active { background: var(--cat, var(--accent));
  border-color: var(--cat, var(--accent)); color: #fff; }  /* unchanged rule; works because Task 4 darkens the palette */
```

- [ ] **Step 3: Verify**

Run: `node scripts/contrast.mjs` → OK.
Run: `grep -nE "#1d8a4e|#1db954|#eaf7ef|#eef8f1|#b4232a|#b3261e|#fbecec|#8a6d1d|#d9a521|#fff3a3|#fff3bf|#fff8d6|#f2c200|#f7fafe|#ffab5e|#ff9633|#fff4e8|#ffe2c2|#0066cc|#0077ed|@keyframes pulse" style.css`
Expected: no output.
Serve and screenshot `/systems` (filter chips page), one quiz-bearing page (find one: `grep -rl 'quiz.js' --include="*.html" . | head -1`), and `/software/index.html` (window embed). Expected: no yellow/green/red legacy colors, flattened window with no traffic lights, quiet quiz states.

- [ ] **Step 4: Commit**

```bash
git add style.css
git commit -m "Recolor components to the earthy family and remove the pulse, gloss, and window chrome

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Earthy category palette in systems-filter.js

**Files:**
- Modify: `systems-filter.js:8-15,30`

**Interfaces:**
- Consumes: the text-safe hex values from Task 1 (hard-coded here because the JS sets inline `--cat` values consumed by `.syschip.active` white-on-solid, so every value below must keep 4.5:1 under white text; all five do, verified by the `white-on-*` pairs in contrast.mjs).

- [ ] **Step 1: Swap the palette**

Replace lines 8-15:

```js
    "Distributed building blocks": ["#8F3F71", "🧩"],
    "Search and discovery": ["#35624A", "🔍"],
    "Social and messaging": ["#9A3403", "💬"],
    "Media and storage": ["#8A5A0F", "🎬"],
    "Location and maps": ["#43684A", "🗺"],
    "Data pipelines and observability": ["#35624A", "📊"],
    "Reservations and money": ["#8A5A0F", "💳"],
    "Machine learning systems": ["#8F3F71", "🤖"]
```

And line 30's fallback: `["#868e96", "•"]` → `["#756D60", "•"]`.

- [ ] **Step 2: Verify**

Run: `grep -nE "#7a5af0|#0e9488|#d6336c|#e8590c|#2f9e44|#1098ad|#b08900|#6741d9|#868e96" systems-filter.js`
Expected: no output.
Serve and screenshot `/systems`: chips show the earthy palette; click one chip (Playwright) and confirm the active state is a dark earthy solid with legible white text; section h2 left rules and list dot markers pick up the same colors.

- [ ] **Step 3: Commit**

```bash
git add systems-filter.js
git commit -m "Move the systems categories onto the earthy palette

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Homepage copy, linked-heading sections, and hue keying

**Files:**
- Modify: `index.html`, `style.css` (add `h2.index-link` rules after the `.section-head` block)

**Interfaces:**
- Consumes: hue utility classes and tokens from Task 1, exact names as listed there.
- Produces: `h2.index-link` (used only here).

- [ ] **Step 1: Add the linked-heading CSS**

```css
/* homepage index sections: the heading is the link, with a hue tick */
h2.index-link { position: relative; padding-left: 18px; }
h2.index-link::before { content: ""; position: absolute; left: 0; top: 0.34em;
  width: 8px; height: 8px; background: rgb(var(--h, var(--terra))); }
h2.index-link a { color: inherit; text-decoration: none; }
h2.index-link a::after { content: " \2192"; color: var(--ht, var(--accent));
  opacity: 0; transition: opacity 0.2s ease; }
h2.index-link:hover a::after { opacity: 1; }
h2.index-link:hover a { text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--ht, var(--accent)) 35%, transparent); }
```

- [ ] **Step 2: Replace the hero copy and CTA**

In `index.html`, replace the `.lead` paragraph content with (verbatim from the spec):

> I build apps that people find useful, and the systems behind them. Some of the work is machine learning: models trained, served, and measured against real use. The rest is careful, ordinary software, from a live status page to a desktop chess game. I studied electrical engineering at UT Austin and computer science at Stanford, and I have worked at both large companies and startups.

Replace the CTA row:

```html
<div class="cta-row">
  <a class="btn primary" href="/ai">See the work</a>
  <a class="btn link" href="mailto:stanleyjacobai@gmail.com">Get in touch</a>
</div>
```

- [ ] **Step 3: Replace the four About paragraphs**

Use the spec's About paragraphs 1-4 verbatim (spec section "Copy (final, verbatim)"; paragraph 4 keeps `class="quiet"`). Copy them from the spec file, not from memory.

- [ ] **Step 4: Hue-key the cards and skills**

- Selected work anchors: `class="proj hue-teal"` (speech), `hue-terra` (rust coder), `hue-gold` (credit risk), `hue-plum` (chess), `hue-sage` (uptime), `hue-teal` (robot imitation).
- Skills cells, in DOM order: `hue-teal`, `hue-sage`, `hue-gold`, `hue-terra`, `hue-plum`, `hue-teal`, `hue-sage`, `hue-gold` (added to `class="cell"`).

- [ ] **Step 5: Convert the five index sections**

Each of the five sections (Systems design, Algorithms, Machine learning, Reinforcement learning, Open source) keeps its description paragraph but loses the `.cta-row` block entirely; the h2 becomes the link. Hues: systems teal, algorithms gold, ml terra, rl plum, oss sage. Pattern, applied five times with each section's existing text:

```html
<section class="soft">
  <div class="wrap">
    <div class="section-head hue-teal">
      <h2 class="index-link"><a href="/systems">Systems design</a></h2>
      <p>Design walkthroughs of the systems behind familiar products, ...</p>
    </div>
  </div>
</section>
```

Keep the existing soft/plain section alternation exactly as it is today (systems plain, algorithms soft, ml plain, rl soft, oss plain).

- [ ] **Step 6: Verify**

```bash
grep -c "—" index.html                     # expect 0 (grep exits 1)
grep -ciE "isn't just|not just|delve|seamless|leverage|crucial|comprehensive|the point is|the range follows" index.html   # expect 0
grep -c "Browse" index.html                # expect 0 (grep exits 1)
grep -c "kicker" index.html                # expect 0 (grep exits 1)
grep -c "H100\|FP8\|BF16" index.html       # expect 0 in hero/About; the Selected work card blurbs keep their text, so if this hits, confirm every hit is inside a .proj card and none elsewhere
node scripts/contrast.mjs                  # OK
```

Serve and screenshot the full homepage at 1280px and 390px. Expected: hue ticks before the five linked headings, arrow on hover (screenshot one hover state), hue-tinted chips on the six cards, rotating label colors in Skills, no buttons below the fold except the hero pair.

- [ ] **Step 7: Commit**

```bash
git add index.html style.css
git commit -m "Soften the homepage copy and replace browse buttons with hue-keyed linked headings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Site-wide QA sweep

**Files:**
- Modify: only what the sweep flags (expect small fixes, no planned edits)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Automated checks across the repo**

```bash
cd ~/stanleyjacob.dev
grep -rn "—" --include="*.html" . | grep -v docs/            # expect nothing
grep -rniE "#0066cc|#0077ed" --include="*.html" --include="*.css" --include="*.js" . | grep -v docs/   # expect nothing
node scripts/contrast.mjs                                    # OK
grep -rn "fonts.googleapis\|fonts.gstatic\|cdn\." --include="*.html" --include="*.css" . | grep -v docs/  # expect nothing
```

The favicon's `#1d1d1f` in `index.html` is acceptable (it is the tab icon, not page styling); optionally swap it to `#2B2621` for consistency.

- [ ] **Step 2: Visual sweep of one page per template**

Serve locally, then with the Playwright browser screenshot each at 1280px, plus the homepage at 390px:
`/` , `/systems` (filter chips), one systems article, `/algorithms` (pattern grid + article card), one ML page with code tabs (`grep -rl 'code-tabs' --include="*.html" . | head -1`), one page with the dark `pre.shl` blocks, one quiz page (`grep -rl 'quiz.js' --include="*.html" . | head -1`), one page with the reader bar (`grep -rl 'reader.js' --include="*.html" . | head -1`), `/ai` or `/software` (window embed, badge).

Check each against the register: cream surfaces, serif prose, earthy hues only in links/chips/labels/markers, dark code cards sitting cleanly on cream, no leftover blue/green/red/yellow product colors, nothing animated.

- [ ] **Step 3: Fix anything flagged, re-run Step 1, commit**

```bash
git add -A
git commit -m "Fix the stragglers found in the site-wide design sweep

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(Skip the commit if the sweep found nothing.)

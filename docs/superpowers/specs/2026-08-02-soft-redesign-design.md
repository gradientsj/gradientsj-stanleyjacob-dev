# Soft redesign: Thinking Machines register with a warm, colorful palette

Date: 2026-08-02
Status: approved direction (mock D), spec pending Stan's review
Reference mockup: `mock-d-warm-field.html` (session scratchpad; direction C base + multi-hue keying)

## Goal

Shift stanleyjacob.dev from its current Apple-flavored product look (white, blue #0066cc,
pill buttons, pulse badge, macOS window chrome) to a soft, professional, editorial
register in the spirit of thinkingmachines.ai, but warmer and a bit more colorful.
Soften the copy so machine learning reads as one thread of the work rather than the
headline. The change is site-wide through the shared `style.css`; copy rewrites are
limited to the homepage hero and About.

## Non-goals

- No change to site structure, nav tabs, or section order.
- No content rewrites outside the homepage hero and About (card blurbs, section
  descriptions, and article pages keep their text).
- No change to the semantic code-highlighting palette. Code cards stay dark
  (#282a36) with the palette verified by `scripts/palette.mjs`. Only the card
  border may warm slightly to sit well on cream.
- No platform migration (stays static HTML on Vercel, no build step added).

## Design tokens

Palette (all values contrast-verified in mock D against the cream backgrounds,
card tints, and 9%-opacity chip tints):

| Token | Value | Role |
|---|---|---|
| `--bg` | `#FAF6F0` | page background (warm cream) |
| `--bg-soft` | `#F2EDE4` | alternating sections |
| `--bg-card` | `#FCF9F4` | cards |
| `--bg-card-hover` | `#F5EEE1` | card hover wash |
| `--text` | `#2B2621` | ink |
| `--muted` | `#6F675C` | secondary text |
| `--line` | `#E5DECF` | hairlines |
| `--accent` | `#AF3A03` | terracotta: prose links, primary buttons |
| `--accent-press` | `#9A3403` | terracotta hover / text on tints |
| Hue family (text-safe variants) | teal `#35624A`, sage `#43684A`, gold `#8A5A0F`, plum `#8F3F71`, terracotta `#9A3403` | section keying, chips, micro-labels |
| Hue family (tint bases) | teal `#427B58`, sage `#689D6A`, gold `#B57614`, plum `#8F3F71`, terracotta `#AF3A03` | 9%-opacity chip backgrounds, 20%-alpha chip borders |

Typography:

- Prose and headings: `'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif`
  (Iowan Old Style is Thinking Machines' own serif; it ships with macOS/iOS and
  Georgia is their declared fallback). Body 16 to 17px, line-height 1.65; h2 about
  24 to 26px weight 600.
- Tracked labels (brand wordmark, skills micro-labels, chip text): Chakra Petch,
  self-hosted woff2, latin subset, weights 400 and 500, uppercase,
  letter-spacing 0.08em, 12px. Fallback: the system sans stack.
- Small UI (nav links, buttons, tags, footer): system sans stack at 13 to 14px.
- Code: unchanged mono stack in unchanged dark cards.

Layout and texture:

- Grid sections max 960px; prose measure about 680px.
- Slim sticky nav (about 52px), hairline bottom border, translucent cream with
  backdrop blur.
- Prose links underlined with the underline color at about 35% opacity,
  full strength on hover; 0.2s ease transitions.
- Cards: 1px hairline border, radius 8px, no box shadow, gentle background wash
  on hover, no lift or translate.
- Remove: the pulse badge animation, the macOS window chrome treatment
  (`.window` bar, traffic-light dots, iframe scale trick becomes a plain
  hairline-framed embed), gradient overlays, and heavy drop shadows.
- Section vertical padding 56 to 72px; whitespace does the structural work.

## Hue keying (color as wayfinding, never emphasis)

Color never touches headings or body text. It appears only in links, chips,
micro-labels, and small markers.

- Selected work chips, keyed by domain: speech/diarization teal, training and
  fine-tuning terracotta, credit risk gold, chess plum, monitoring sage,
  robotics teal.
- Skills micro-labels rotate teal, sage, gold, terracotta, plum.
- The five index sections: Systems design teal, Algorithms gold, Machine
  learning terracotta, Reinforcement learning plum, Open source sage.
- Elsewhere on the site, existing colored category chips adopt the same family
  (nearest hue), using text-safe variants on tints. Quiz feedback recolors to
  sage (correct) and terracotta (incorrect), keeping the semantics.

## De-repetition of scaffold labels

- No generic kickers anywhere: no "Introduction", "Projects", "Capabilities",
  and no row of "Browse X" buttons.
- About, Selected work, and Skills sections carry their h2 alone.
- The five index sections lose their buttons; the h2 itself becomes the link,
  preceded by a small hue-colored tick (a short rule or square) and followed by
  a hue-colored arrow on hover. Text stays ink. Each section keeps its existing
  one-paragraph description.
- The numbered kickers on article pages ("01", "02", ...) are step markers, not
  generic scaffolding; they stay.

## Copy (final, verbatim)

Rules applied: no em dashes anywhere in new copy; no AI-tell phrasing (no
"isn't just", "delve", "seamless", "leverage", no forced synonym variety); keep
Stan's established first-person voice; hardware and precision specifics (H100,
FP8, 8B, BF16) live on project pages, not the homepage hero or About.

Hero lead:

> I build apps that people find useful, and the systems behind them. Some of
> the work is machine learning: models trained, served, and measured against
> real use. The rest is careful, ordinary software, from a live status page to
> a desktop chess game. I studied electrical engineering at UT Austin and
> computer science at Stanford, and I have worked at both large companies and
> startups.

About, paragraph 1:

> I like to build apps that people find useful and can draw insight from, and
> that have some machine learning or mathematical element to them. The projects
> I keep returning to are the ones a person can open and use: a public status
> page that watches live services, a transcription tool that streams who said
> what a few seconds behind live, a desktop chess game whose engine is checked
> against millions of reference positions. Machine learning runs through most
> of my work, but the model is rarely interesting on its own; what matters is
> the application around it. Most of what I build combines existing technology
> into something more useful than its parts, and gives applications memory in
> an ordinary database so they get better the longer you use them.

About, paragraph 2:

> My interest in this kind of work goes back to school. I studied electrical
> engineering at UT Austin and then spent three years in computer science at
> Stanford, where the timing mattered: transformer models were just emerging,
> and I focused my coursework on them as language, vision, audio, and speech
> were converging on the same architecture. Since then I have worked at both
> large companies and startups, and I care as much about getting models to run
> well in production as about training them.

About, paragraph 3:

> That background is why the work spans both ends of the stack. On one end I
> train and serve models; on the other I design the interface, the schema, and
> the deployment for the app a person actually touches. Evaluation ties the two
> ends together, whether that means a calibrated judge for model outputs or an
> error budget for a web service, because measurement is what separates a
> product from a demo.

About, paragraph 4 (quiet style):

> Outside of work I am usually building apps and design projects for their own
> sake. If you'd like to talk or work together, feel free to reach out.

The hero CTA row keeps two links, reworded without the button register:
"See the work" (primary, terracotta) and "Get in touch" (plain link). Exact
treatment per the mockup.

## Files touched

- `style.css`: token swap, typography, nav, buttons, cards, chips, labels,
  removal of pulse/window/gradient rules, hue utility classes.
- `index.html`: hero and About copy, kicker removal, linked-h2 index sections,
  chip hue classes.
- `fonts/chakra-petch-*.woff2` (new): latin subset, 400 and 500, plus
  `@font-face` rules.
- Section index pages and any page using category chips or quiz feedback:
  class-level recolor only, no copy changes.
- `.vercelignore` (new): keeps `docs/` out of the deployment.
- This spec under `docs/superpowers/specs/`.

## Verification

- `grep -c "—"` returns 0 across all HTML (already true today; must stay true).
- A contrast pass over the final CSS tokens confirming every text/background
  pair composited on cream meets WCAG AA 4.5:1 (chip text on 9% tints included).
- Visual QA screenshots of representative templates: homepage, one systems
  article, one algorithms page, one ML page, one quiz page, one deep chapter,
  in desktop and narrow widths, checked against the mock D register.
- No external font or asset requests introduced (fonts self-hosted).
- `node scripts/highlight.mjs` NOT re-run (no code block changes); code cards
  visually checked on the cream background.

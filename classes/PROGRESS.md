# Coursework section: build log and handoff notes

Working log for the `/classes` section so a fresh agent can pick this up
mid-build. Update the status table at the bottom after every batch.

## What this is

A coursework tab holding 56 long-form technical write-ups, one per subject,
covering machine learning, language and generative models, reinforcement
learning, systems and architecture, algorithms and theory, graphics, robotics,
and applied domains. The pages are study material: full derivations, worked
problems with real arithmetic, PyTorch and JAX implementations side by side,
production practice, the current research frontier, open-source pointers, a
self-check quiz, and references to textbooks and papers.

The owner's stated goal is internalizing this material to a level competitive
for a top applied-ML position, so depth beats breadth on every page.

## Non-negotiable constraint

**No page may reference a course, course number, department, professor,
syllabus, lecture, or problem set.** Everything is anchored on textbooks and
research papers instead. The source request listed university courses only as a
scope definition. A page containing "CS 229", "in lecture", or "problem set" is
a defect and must be rewritten.

Naming an institution is a different matter and is encouraged: attributing a
result or project to the group that produced it ("Berkeley's Gemmini", "a line
of work at ETH Zurich") is exactly the cross-referencing these pages are for.
The validator flags course scaffolding, not citations.

## Files

| Path | Role |
| --- | --- |
| `tools/classes_data.py` | Taxonomy: groups, slugs, titles, blurbs, tags. Single source of truth. |
| `tools/generate_classes.py` | Renders `classes/index.html` from the taxonomy. Re-run after adding pages; unwritten pages render as dimmed non-links. |
| `tools/add_classes_nav.py` | Idempotent sitewide nav insertion (already run over 194 pages). |
| `classes/AUTHORING.md` | The spec every article is written against. Read before authoring. |
| `classes/math.js` | KaTeX loader (CDN, auto-render, `$$`/`\(`), with macros. |
| `classes/data/bench_h100.py` | Benchmark script for the measured numbers. |
| `classes/data/h100.json` | Its output: real H100 80GB numbers, quotable in articles. |
| `scripts/highlight.mjs` | Build-time syntax highlighting. Run after writing pages. |
| `quiz.js`, `code-tabs.js`, `code-copy.js` | Client behavior the pages opt into. |

## Build commands

Node is not installed system-wide on this machine. It was installed locally to
`~/.local/node`, so put it on PATH first:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
node scripts/highlight.mjs          # bake syntax highlighting + copy buttons
python tools/generate_classes.py    # relink index against pages that now exist
python tools/add_classes_nav.py     # only if new top-level pages appear
python tools/check_classes.py       # validate pages against AUTHORING.md
```

`check_classes.py` enforces the no-course-reference rule, verifies the quiz JSON
parses, checks that every tabbed `<pre>` has a matching language button, and
warns on pages that are short on problems or references. It deliberately does
not flag institution names: attributing a result to the group that produced it
is the cross-referencing these pages are for.

## Measured hardware numbers

`classes/data/h100.json`, from an NVIDIA H100 80GB HBM3 (132 SMs, compute
capability 9.0, PyTorch 2.7.0, CUDA 12.8) on the machine this was built on.
Highlights worth quoting:

- HBM streaming bandwidth about 3.0-3.1 TB/s (copy, add, and sum all land there)
- Dense matmul at 8192: 51 TFLOPS fp32, 410 TFLOPS tf32, 729 TFLOPS bf16
- Attention at 8192 tokens (batch 8, 16 heads, head dim 64): naive materialized
  scores 98.9 ms and 35.0 GB peak, fused path 3.58 ms and 0.57 GB, a 27.7x
  speedup at 61x less memory
- At 16384 tokens the naive path cannot run at all: the score matrix alone is
  68.7 GB. The fused path does it in 13.7 ms at 640 TFLOPS.
- Elementwise chain fusion via `torch.compile`: 0.911 ms to 0.214 ms, 4.3x

Rerun with `python classes/data/bench_h100.py > classes/data/h100.json`.

## Status

Legend: `todo` not started, `wip` claimed by an agent, `done` written and
highlighted.

Counts are updated at the end of each batch; see the git log for per-page
history.

| Group | Pages | Done |
| --- | --- | --- |
| Machine learning foundations | 5 | 0 |
| Language, generative, multimodal | 11 | 0 |
| Reinforcement learning and decisions | 7 | 0 |
| Systems, architecture, data at scale | 10 | 0 |
| Algorithms, theory, optimization, security | 7 | 0 |
| Graphics, rendering, 3D | 5 | 0 |
| Robotics and embodied intelligence | 5 | 0 |
| Applied domains, product, interfaces | 6 | 0 |
| **Total** | **56** | **0** |

## Log

### Session 1 (2026-07-23)

- Surveyed the existing site: static HTML, no framework, no client-side
  libraries, build-time syntax highlighting via Shiki, existing sections
  `/ai /robotics /software /algorithms /systems /ml /rl /oss`. Matched that
  structure rather than introducing tooling.
- Added the `Classes` nav link to all 194 existing pages and a Classes section
  on the homepage (section shading re-alternated to stay consistent).
- Introduced KaTeX for real math, loaded only on coursework pages, so the rest
  of the site keeps its zero-client-library property.
- Wrote and ran the H100 benchmark suite; results in `classes/data/h100.json`.
- Wrote `classes/AUTHORING.md` (the article spec) and generated the index from
  the taxonomy.
- Wired the previously unused `quiz.js` engine into the article spec, since the
  pages are meant for self-testing.

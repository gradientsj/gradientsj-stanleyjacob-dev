# Authoring spec for `/classes/<slug>/index.html`

Every coursework page is written against this spec. Read it in full before
writing. The goal of these pages is stated plainly: they are study material for
internalizing a subject deeply enough to hold a technical conversation with the
strongest people working in it, and to answer interview questions at the level
of a senior applied-ML or systems role. Write for a reader who already knows how
to program and wants the actual derivations, not an overview.

## Hard rules

1. **Never name a course, course number, university, department, professor,
   problem set, or lecture.** No "CS 229", no "Stanford", no "Week 3", no
   "Problem Set 2", no "as taught in". Anchor everything on *textbooks* and
   *research papers* instead. This rule has no exceptions; a single course
   reference means the page must be rewritten.
2. **Derive the math, do not assert it.** Every important result gets its steps.
   If a gradient is stated, show the differentiation. If a bound is claimed,
   show where each inequality comes from. "It can be shown that" is banned;
   either show it or say explicitly that the proof is out of scope and cite
   where it lives.
3. **Work problems.** At least four substantial worked problems per page, in
   `.problem` blocks, with full solutions containing real arithmetic. These
   should be the kind of problem a strong graduate course or a hard interview
   would ask. Include at least one that is a numerical computation the reader
   can verify by hand, and at least one derivation/proof.
4. **Code must be correct and runnable.** PyTorch and JAX side by side in the
   same `.code-tabs` block wherever a model or algorithm appears. Add C++,
   Rust, CUDA, Triton, TypeScript, or Swift tabs where the subject calls for
   them. Shapes annotated in comments. No pseudocode presented as code.
5. **Cross-reference the field broadly.** The reference list must draw on work
   from many groups, not one: MIT, CMU, Berkeley, Georgia Tech, UT Austin,
   Cornell, Harvard, Dartmouth, Princeton, Washington, Michigan, Toronto,
   Oxford, Cambridge, ETH Zurich, EPFL, INRIA, Max Planck, Tsinghua, Peking,
   Shanghai Jiao Tong, KAIST, NUS, Technion, Weizmann, plus industry labs
   (Anthropic, OpenAI, Google DeepMind, Meta AI, NVIDIA, Microsoft Research,
   Apple, Mistral, Qwen/Alibaba, DeepSeek, Moonshot, Zhipu, Cohere, Allen AI).
   Where a result has a well-known competing or complementary line of work from
   a different group, say so in the text.
6. **Do not fabricate.** Papers, authors, years, repository names, API
   signatures, and numbers must be real. If unsure of a detail, describe the
   idea without the specific claim. Never invent a citation. Numbers presented
   as measurements must come from `classes/data/h100.json` (real runs on this
   machine) or be clearly labeled as figures reported in a cited paper.
7. **Length.** Target 1,200-2,200 lines of HTML per page. These are deep
   references, not blog posts. Err long.

## Voice

Match the existing site: calm, declarative, technical, no marketing language,
no exclamation marks, no "let's dive in", no bulleted fragments where a
paragraph belongs. Prefer prose that explains *why* a design is the way it is.
Read `/ml/attention/index.html` before writing your first page; it is the
reference for tone and density. Do not use em dashes; use commas, colons, or
semicolons. Do not address the reader as "you" more than sparingly.

## Page skeleton

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SHORT TITLE &middot; Stanley Jacob</title>
    <meta name="description" content="One sentence, 200-300 chars, concrete." />
    <link rel="stylesheet" href="/style.css" />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='24' fill='%231d1d1f'/%3E%3Ctext x='50' y='70' font-size='52' font-weight='600' text-anchor='middle' font-family='-apple-system,Helvetica,Arial,sans-serif' fill='%23ffffff'%3Esj%3C/text%3E%3C/svg%3E" />
  </head>
  <body>
    <nav class="top">
      <div class="inner">
        <div class="brand"><a href="/">Stanley Jacob</a></div>
        <div class="links">
          <a href="/ai">AI</a>
          <a href="/robotics">Robotics</a>
          <a href="/software">Software</a>
          <a href="/classes" class="active">Classes</a>
          <a href="/algorithms">Algorithms</a>
          <a href="/systems">Systems</a>
          <a href="/ml">ML</a>
          <a href="/rl">RL</a>
          <a href="/oss">Open source</a>
          <a href="https://github.com/gradientsj" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </div>
    </nav>

    <header class="hero">
      <div class="wrap">
        <div class="eyebrow"><a href="/classes">Classes</a></div>
        <h1>FULL TITLE</h1>
        <p class="lead">Three to six sentences: what the subject is, what the
          page derives, and what a reader will be able to do afterward.</p>
      </div>
    </header>

    <section class="soft">
      <div class="wrap">
        <article class="prose article">
          ... all content sections ...
        </article>
      </div>
    </section>

    <footer class="site">
      <div class="inner">
        <span>&copy; <span id="yr">2026</span> Stanley Jacob</span>
        <span>
          <a href="https://github.com/gradientsj" target="_blank" rel="noreferrer">GitHub</a>
          &nbsp;&middot;&nbsp; <a href="mailto:stanleyjacobai@gmail.com">stanleyjacobai@gmail.com</a>
        </span>
      </div>
    </footer>
    <script defer src="/classes/math.js"></script>
    <script defer src="/code-tabs.js"></script>
    <script defer src="/quiz.js"></script>
    <script>
      document.getElementById("yr").textContent = new Date().getFullYear();
    </script>
    <script defer src="/code-copy.js"></script>
  </body>
</html>
```

## Required content sections (in this order)

Use `<h2>` for each, `<h3>` for subsections.

1. **Why this subject matters now** — what changed in the last few years, and
   what a practitioner is expected to know today that they were not five years
   ago.
2. **Core theory** — the main derivations, several `<h3>` subsections. This is
   the bulk of the page. Full LaTeX.
3. **Worked problems** — four or more `.problem` blocks. May also be
   distributed through the theory sections instead of collected, whichever
   reads better; if distributed, still include at least two here.
4. **Implementation** — PyTorch and JAX (and other languages as relevant) with
   `.code-tabs`. Explain what the code demonstrates before each block.
5. **How it is done in practice** — production systems, scale, the engineering
   gap between the derivation and a deployed system. Include measured numbers
   where available.
6. **The current research frontier** — the last two to four years, with the
   competing approaches and who is behind them, drawn from multiple
   institutions and companies per rule 5.
7. **Open source to read** — 5-10 repositories with what each is good for and
   which file to open first. Real repositories only, linked as
   `https://github.com/org/name`.
8. **Common misconceptions** — 4-8 items, each a bolded claim followed by why
   it is wrong. Model this on the closing section of `/ml/attention/`.
9. **Self-check** — a `.quiz` block (format below), 8-12 questions.
10. **References** — `<ol class="refs">`, 12-25 entries: textbooks first, then
    papers, each with authors, year, and a link where a stable one exists
    (arXiv, DOI, or the project page). Never link to a course site.
11. **Key takeaway** — one `.takeaway` div, four to eight sentences.

## Markup conventions

**Math (KaTeX).** Inline `\( ... \)`, display `$$ ... $$`. The loader
`/classes/math.js` renders both. Inside HTML, escape `<` as `&lt;` and `&` as
`&amp;` even within math. Do not put math inside `<pre>` or `<code>`; KaTeX
skips those by design. Available macros: `\R \E \P \N \L \D \T \argmin \argmax
\softmax \KL \diag \tr \Var \Cov`.

```html
<p>The gradient of the negative log-likelihood is
\( \nabla_\theta \L = -\sum_i (y_i - \sigma(\theta\T x_i)) x_i \), which
vanishes exactly at the maximum-likelihood solution.</p>

$$ \L(\theta) = -\frac{1}{n}\sum_{i=1}^{n}\Big[ y_i \log \hat{p}_i + (1-y_i)\log(1-\hat{p}_i) \Big] $$
```

**Worked problems.**

```html
<div class="problem">
  <span class="plabel">Problem 3</span>
  <p>Statement of the problem, fully specified, with concrete numbers.</p>
  <div class="solution">
    <p><strong>Solution.</strong> Step-by-step work with real arithmetic,
    ending in a stated result and a sentence on what it means.</p>
  </div>
</div>
```

**Code.** Write plain, unhighlighted code; the build step colors it. Use exactly
this structure, with `data-lang` on each `<pre>` and one button per language:

```html
<div class="code-tabs">
  <div class="lang-row">
    <button data-lang="pytorch" class="active">PyTorch</button>
    <button data-lang="jax">JAX</button>
  </div>
  <pre data-lang="pytorch" class="lang active"><code class="language-python">import torch
...
</code></pre>
  <pre data-lang="jax" class="lang"><code class="language-python">import jax
...
</code></pre>
</div>
```

Valid `data-lang` values: `pytorch`, `jax`, `python`, `cpp`, `c`, `rust`, `go`,
`typescript`, `swift`, `sql`, `bash`, `cuda`, `triton`. Button label is the
display name (PyTorch, JAX, C++, Rust, CUDA, Triton, ...). The `<code>` class
must be `language-python` for python-family tabs, `language-cpp` for C/C++ and
CUDA, `language-rust`, `language-typescript`, `language-swift`,
`language-sql`, `language-bash`. Escape `<`, `>`, and `&` inside code blocks as
`&lt;`, `&gt;`, `&amp;`. Do not add a copy button; the build step inserts it.

**ASCII diagrams.** `<pre class="flow">...</pre>`, as in `/ml/attention/`. Use
these for architectures, pipelines, and memory layouts. They render well and
cost nothing.

**Tables.** Wrap in `<div class="tbl-wrap"><table class="data">...</table></div>`.

**Quiz.**

```html
<div class="quiz" data-quiz>
  <script type="application/json" class="quiz-data">[
    {"id": "q1", "qtype": "mcq", "stem": "...", "options": ["a","b","c","d"],
     "correctIndex": 2, "explanation": "..."},
    {"id": "q2", "qtype": "truefalse", "stem": "...", "options": ["True","False"],
     "correctIndex": 0, "explanation": "..."},
    {"id": "q3", "qtype": "ordering", "stem": "Order these steps.",
     "options": ["first","second","third","fourth"], "correctIndex": -1,
     "explanation": "..."}
  ]</script>
</div>
```

JSON must be valid and contain no raw `<` or `</` sequences. Questions should
test understanding, not recall of a number. Explanations are one to three
sentences. Note that the quiz JSON is not processed by KaTeX, so write math in
plain text there.

**Numerical environment hazard (read before measuring anything).** The system
Python's NumPy 1.21 was linked against a broken reference LAPACK on this host:
`linalg.solve`, `svd`, `qr`, and `cholesky` silently returned garbage for
matrices of size 50 and above, while plain matrix multiply stayed correct. That
is the worst kind of failure, because the wrong answers look plausible. It was
fixed on 2026-07-24 by installing NumPy 2.2.6 and SciPy 1.15.3, whose wheels
bundle their own OpenBLAS. Before publishing any number that came from a CPU
factorization, sanity-check it: solve a system and confirm the residual, or
reconstruct a matrix from its SVD and confirm the error is near machine epsilon.
Torch on the GPU goes through cuBLAS/cuSOLVER and was never affected.

**Measured numbers.** `classes/data/h100.json` holds real benchmark output from
an NVIDIA H100 80GB HBM3 (132 SMs, PyTorch 2.7, CUDA 12.8) in this repository.
Quote from it directly when a page discusses memory bandwidth, matmul
throughput, attention cost, or kernel fusion, and say the measurement came from
an H100 80GB. Do not round away the interesting digits and do not invent
additional entries. The generating script is `classes/data/bench_h100.py`.

## After writing

The page is written as plain code; run the highlighter from the repo root to
bake in colors and copy buttons:

```
node scripts/highlight.mjs
```

Then `python tools/generate_classes.py` to relink the index.

## Validation checklist

- [ ] No course, university, professor, or syllabus reference anywhere
- [ ] Every `<pre>` in a `.code-tabs` has `data-lang` and a matching button
- [ ] All `<`, `>`, `&` inside code and math escaped
- [ ] Quiz JSON parses (`python -c "import json,re,sys; ..."`)
- [ ] Four or more `.problem` blocks with real arithmetic in the solutions
- [ ] References are real, dated, and span multiple institutions
- [ ] Nav includes `<a href="/classes" class="active">Classes</a>`
- [ ] All four scripts at the bottom: math, code-tabs, quiz, code-copy

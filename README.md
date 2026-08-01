# stanleyjacob.dev personal site

A static portfolio and technical library with no build step:

- `index.html` → employer-facing overview
- `work/index.html` → filterable, evidence-first case-study index
- `robotics/index.html` → embodied AI, simulation, and robot-learning work
- `ai/index.html` → model systems, audio, retrieval, evaluation, and decision products
- `software/index.html` → AI coding, GPU kernels, architecture, and production software
- `software/cpp/index.html` → modern C++ language and standard-library internals
- `software/cpp/patterns/` → seven C++-only algorithm-pattern chapters and recognition map
- `examples/cpp-patterns/` → tested C++20 implementations with sanitizer and differential-test coverage
- `benchmarks/cpp-two-sum/` → differential tests, Google Benchmark measurements, raw results, and Linux `perf stat` collection
- `classes/`, `systems/`, `ml/`, `rl/`, `oss/` → supporting technical library
- `style.css` → shared responsive light/dark design system

## Add a project or note
- **Project:** add a case study with a status, repository/artifact, evaluation
  protocol, results, failure analysis, and limitations. Use `status-pill
  building` until the artifact and evidence exist; do not present a design
  dossier as shipped work.
- **Note / blog post:** add an `<li>` to the `.notes` list on the area page
  or a `.proj`/`.blueprint` card on the relevant index.
- **Fast-changing claims:** include an exact model/version, primary source, and
  visible verification date.

## Run locally
Any static server works, e.g.:
```bash
npx --yes serve .
# or
python -m http.server 8000
```
Then open http://localhost:8000 (or :3000 for `serve`).

## Validate

```bash
python3 tools/check_html.py .
python3 tools/check_internal_links.py .
node tools/check_cpp_guide.mjs
node tools/check_cpp_pattern_pages.mjs
cmake -S examples/cpp-patterns -B examples/cpp-patterns/build -DCMAKE_BUILD_TYPE=Release
cmake --build examples/cpp-patterns/build --parallel
ctest --test-dir examples/cpp-patterns/build --output-on-failure
git diff --check
```

## Generate and cache article narration

Article pages use `/reader.js`. If a page has
`<div class="reader" data-reader data-audio="listen.mp3"></div>`, the player
serves that static MP3 through Vercel's CDN and falls back to the browser voice
when the file has not been generated yet.

Generate an ElevenLabs narration from a trusted local or CI environment:

```bash
export ELEVENLABS_API_KEY=...
export ELEVENLABS_VOICE_ID=... # optional
node scripts/generate-audio.mjs rl/dpo/index.html
```

The script writes `listen.mp3` and `listen.meta.json` beside the article. The
metadata contains a hash of the narration text, voice, model, and settings.
Running the command again reuses the existing audio unless one of those inputs
changed. Use `--force` only when regeneration is intentional. The API key
must remain server-side and must never be added to page JavaScript or Git.

## Deploy (Vercel)
1. Push this folder to its own GitHub repo (e.g. `gradientsj/stanleyjacob-dev`).
2. Vercel → New Project → import that repo. Framework preset: **Other** (it's
   static, no build command, output is the repo root).
3. Settings → Domains → add **`stanleyjacob.dev`** and **`www.stanleyjacob.dev`**.
4. In Porkbun DNS, add the records Vercel shows (apex usually an `A`/`ALIAS`, www
   a `CNAME`). See the deploy notes in chat / the monitor's docs for the exact
   Porkbun steps.

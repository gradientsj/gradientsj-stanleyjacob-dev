# stanleyjacob.dev personal site

A static portfolio and technical library with no build step:

- `index.html` → employer-facing overview
- `work/index.html` → filterable, evidence-first case-study index
- `robotics/index.html` → embodied AI, simulation, and robot-learning work
- `ai/index.html` → model systems, audio, retrieval, evaluation, and decision products
- `software/index.html` → AI coding, GPU kernels, architecture, and production software
- `software/cpp/index.html` → modern C++ language, standards, and interview-pattern field guide
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
git diff --check
```

## Deploy (Vercel)
1. Push this folder to its own GitHub repo (e.g. `gradientsj/stanleyjacob-dev`).
2. Vercel → New Project → import that repo. Framework preset: **Other** (it's
   static, no build command, output is the repo root).
3. Settings → Domains → add **`stanleyjacob.dev`** and **`www.stanleyjacob.dev`**.
4. In Porkbun DNS, add the records Vercel shows (apex usually an `A`/`ALIAS`, www
   a `CNAME`). See the deploy notes in chat / the monitor's docs for the exact
   Porkbun steps.

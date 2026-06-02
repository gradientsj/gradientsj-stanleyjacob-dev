# stanleyjacob.dev personal site

A tiny static site (no build step):

- `index.html` → **stanleyjacob.dev** (about me, areas, skills)
- `ai/index.html` → **stanleyjacob.dev/ai** (machine learning projects + notes)
- `robotics/index.html` → **stanleyjacob.dev/robotics** (robotics projects + notes)
- `software/index.html` → **stanleyjacob.dev/software** (software projects + notes,
  incl. a live preview of [status.stanleyjacob.dev](https://status.stanleyjacob.dev))
- `style.css` → shared light theme

## Add a project or note
- **Project:** copy a `.proj` card block on the relevant area page. Use the
  `badge wip` ("In progress") badge until it ships, then swap to the green
  `badge` ("Live now") badge and add a real link.
- **Note / blog post:** add an `<li>` to the `.notes` list on the area page
  (replacing the "First notes coming soon" empty state), linking to a new HTML
  page for the post. No build tools needed; just edit and redeploy.

## Run locally
Any static server works, e.g.:
```bash
npx --yes serve .
# or
python -m http.server 8000
```
Then open http://localhost:8000 (or :3000 for `serve`).

## Deploy (Vercel)
1. Push this folder to its own GitHub repo (e.g. `gradientsj/stanleyjacob-dev`).
2. Vercel → New Project → import that repo. Framework preset: **Other** (it's
   static, no build command, output is the repo root).
3. Settings → Domains → add **`stanleyjacob.dev`** and **`www.stanleyjacob.dev`**.
4. In Porkbun DNS, add the records Vercel shows (apex usually an `A`/`ALIAS`, www
   a `CNAME`). See the deploy notes in chat / the monitor's docs for the exact
   Porkbun steps.

# stanleyjacob.dev — personal site

A tiny static site (no build step):

- `index.html` → **stanleyjacob.dev** (landing page about me)
- `projects/index.html` → **stanleyjacob.dev/projects** (live browser-window
  preview of [status.stanleyjacob.dev](https://status.stanleyjacob.dev))
- `style.css` → shared dark theme

## Edit the content
Search the HTML for `EDIT:` comments — that's the headline, intro, skill cards,
and links. No build tools needed; just edit and redeploy.

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
   static — no build command, output is the repo root).
3. Settings → Domains → add **`stanleyjacob.dev`** and **`www.stanleyjacob.dev`**.
4. In Porkbun DNS, add the records Vercel shows (apex usually an `A`/`ALIAS`, www
   a `CNAME`). See the deploy notes in chat / the monitor's docs for the exact
   Porkbun steps.

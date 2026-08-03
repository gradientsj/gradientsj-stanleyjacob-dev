#!/usr/bin/env python3
"""Generate neural narration for article pages, aligned to the reader's units.

For each page this:
  1. loads it in headless Chromium and runs the SAME segmentation the reader
     uses at play time (gather + splitSentences + buildUnits), so the unit
     list here is identical to units[] in the browser,
  2. renders each unit with Kokoro-82M (voice am_michael) on the GPU,
  3. concatenates the clips with a small gap into listen.mp3, and
  4. writes narration.json = { n, v, t:[start seconds per unit] } next to it.

The reader loads narration.json and drives sentence highlighting + the
scrubber from the audio's real timeline. Because the unit indices match, t[i]
is exactly when units[i] begins. Run from the repo root.

  python3 tools/gen_narration.py                # all ml/ + ai/ reader pages
  python3 tools/gen_narration.py ml/tokenizers  # just these
"""
import glob
import json
import os
import subprocess
import sys
import time

import numpy as np
import soundfile as sf
from playwright.sync_api import sync_playwright

SR = 24000
GAP_S = 0.18            # silence between units, natural sentence pacing
VOICE = "am_michael"
PORT = 8137

# The extractor mirrors reader.js exactly: same SKIP/READ tags, same class
# skips, same display:none guard, same 90-char whole-block threshold, same
# sentence regex. Runs in the live DOM so getComputedStyle is authoritative.
EXTRACT_JS = r"""
() => {
  const SKIP = {pre:1,svg:1,script:1,style:1,noscript:1,code:1};
  const READ = {p:1,h1:1,h2:1,h3:1,h4:1,li:1,blockquote:1,figcaption:1};
  // mirror reader.js: skip rendered KaTeX so narration units match the reader's
  function inKatex(node) {
    let e = node.parentNode;
    while (e && e.nodeType === 1) {
      if (e.classList && (e.classList.contains("katex") || e.classList.contains("katex-display"))) return true;
      e = e.parentNode;
    }
    return false;
  }
  function readText(el) {
    let s = "";
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = w.nextNode())) { if (!inKatex(n)) s += n.nodeValue; }
    return s.replace(/\s+/g, " ").trim();
  }
  function gather(scope, out) {
    for (const child of scope.childNodes) {
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (SKIP[tag]) continue;
      if (child.classList && (child.classList.contains("quiz") || child.classList.contains("qa") ||
        child.classList.contains("reader") || child.classList.contains("diagram"))) continue;
      if (READ[tag]) {
        if (getComputedStyle(child).display === "none") continue;
        const t = readText(child);
        if (t) out.push(t);
        continue;
      }
      gather(child, out);
    }
    return out;
  }
  const chunks = [];
  const h1 = document.querySelector(".hero h1");
  if (h1) chunks.push(readText(h1));
  gather(document.querySelector("article.prose") || document.body, chunks);

  const SENT_RE = /(?<!\be\.g\.)(?<!\bi\.e\.)(?<!\bvs\.)(?<!\bDr\.)(?<!\bMr\.)(?<!\bMs\.)(?<!\bProf\.)(?<!\bFig\.)(?<!\bNo\.)(?<!\bet al\.)(?<=[.!?])\s+(?=["'“‘(]?[A-Z0-9])/;
  function splitSentences(text) {
    let parts;
    try { parts = text.split(SENT_RE); } catch (e) { parts = [text]; }
    return parts;
  }
  const units = [];
  for (const text of chunks) {
    if (text.length < 90) { units.push(text); continue; }
    for (const s of splitSentences(text)) { const t = s.trim(); if (t) units.push(t); }
  }
  return units;
}
"""


def load_pipeline():
    from kokoro import KPipeline
    return KPipeline(lang_code="a")


def render_unit(pipe, text):
    """Kokoro audio for one unit as a float32 mono array at 24 kHz."""
    parts = []
    for _, _, audio in pipe(text, voice=VOICE):
        parts.append(audio if isinstance(audio, np.ndarray) else audio.numpy())
    if not parts:
        return np.zeros(int(0.2 * SR), dtype=np.float32)
    return np.concatenate(parts).astype(np.float32)


def gen_page(page_dir, units, pipe):
    gap = np.zeros(int(GAP_S * SR), dtype=np.float32)
    pieces, starts, cursor = [], [], 0
    for i, text in enumerate(units):
        if i:
            pieces.append(gap)
            cursor += len(gap)
        starts.append(round(cursor / SR, 3))
        clip = render_unit(pipe, text)
        pieces.append(clip)
        cursor += len(clip)
    pieces.append(np.zeros(int(0.3 * SR), dtype=np.float32))
    master = np.concatenate(pieces)

    wav = os.path.join(page_dir, "_narration.wav")
    mp3 = os.path.join(page_dir, "listen.mp3")
    sf.write(wav, master, SR)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", wav,
         "-ac", "1", "-ar", str(SR), "-b:a", "64k", mp3],
        check=True,
    )
    os.remove(wav)
    with open(os.path.join(page_dir, "narration.json"), "w", encoding="utf-8") as f:
        json.dump({"n": len(units), "v": VOICE, "t": starts}, f)
    return len(master) / SR


def main():
    targets = sys.argv[1:]
    if targets:
        pages = []
        for t in targets:
            t = t.rstrip("/")
            p = t if t.endswith("index.html") else os.path.join(t, "index.html")
            pages.append(p)
    else:
        pages = sorted(
            p for p in glob.glob("ml/*/index.html") + glob.glob("ai/**/index.html", recursive=True)
            if "data-reader" in open(p, encoding="utf-8").read()
        )

    print(f"pages: {len(pages)}")
    srv = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    try:
        time.sleep(1.0)
        # confirm OUR server answers on this port and serves this repo, so a
        # stale server on the same port can never silently feed wrong content
        import urllib.request
        probe = pages[0]
        html = urllib.request.urlopen(f"http://localhost:{PORT}/{probe}", timeout=5).read().decode("utf-8", "ignore")
        if "data-reader" not in html:
            raise SystemExit(f"port {PORT} is serving unexpected content, aborting")
        print(f"server ok on {PORT}", flush=True)
        print("loading Kokoro ...")
        pipe = load_pipeline()
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            for n, page in enumerate(pages, 1):
                url = f"http://localhost:{PORT}/{page}"
                pg = browser.new_page()
                pg.goto(url, wait_until="load")
                # if the page renders math, wait for KaTeX to finish so the
                # extractor sees rendered spans and skips them like the reader
                if "render-math.js" in open(page, encoding="utf-8").read():
                    try:
                        pg.wait_for_selector(".katex", timeout=6000)
                    except Exception:
                        pass
                units = pg.evaluate(EXTRACT_JS)
                pg.close()
                if not units:
                    print(f"  [{n}/{len(pages)}] {page}  SKIP (no units)")
                    continue
                secs = gen_page(os.path.dirname(page), units, pipe)
                print(f"  [{n}/{len(pages)}] {page}  {len(units)} units, {secs:.0f}s audio")
            browser.close()
    finally:
        srv.terminate()


if __name__ == "__main__":
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    main()

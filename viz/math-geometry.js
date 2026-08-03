/* Sieve of Eratosthenes visualizer. Mirrors the AlgViz contract established by
   viz/binary-search.js: build() turns an input into frames, draw() renders one
   frame with Canvas 2D in CSS pixels, caption() describes the step. */
(function () {
  "use strict";

  // status codes: 0 = unknown, 1 = crossed out (composite), 2 = confirmed prime
  function build(input) {
    var n = input.n;
    var frames = [];
    var status = new Array(n + 1);
    for (var i = 0; i <= n; i++) status[i] = 0;
    var count = 0;
    var limit = Math.floor(Math.sqrt(n));

    frames.push({ n: n, status: status.slice(), p: -1, hits: [], newly: [], newlyPrime: [],
      count: 0,
      note: "Write down the integers 2.." + n + ". Nothing is crossed out yet; every number is a candidate prime." });

    for (var p = 2; p <= limit; p++) {
      if (status[p] === 1) {
        frames.push({ n: n, status: status.slice(), p: p, skip: true, hits: [], newly: [], newlyPrime: [],
          count: count,
          note: "p = " + p + " was already crossed out by a smaller prime, so it is skipped." });
        continue;
      }
      status[p] = 2;
      count++;
      frames.push({ n: n, status: status.slice(), p: p, hits: [], newly: [], newlyPrime: [],
        count: count,
        note: "p = " + p + " has never been crossed out, so it is prime (#" + count + "). Now cross out its multiples." });
      var hits = [], newly = [];
      for (var m = 2 * p; m <= n; m += p) {
        hits.push(m);
        if (status[m] === 0) { status[m] = 1; newly.push(m); }
      }
      var shown = [];
      for (var k = 0; k < hits.length && k < 3; k++) shown.push(hits[k]);
      var list = shown.join(", ") + (hits.length > 3 ? ", …, " + hits[hits.length - 1] : "");
      frames.push({ n: n, status: status.slice(), p: p, hits: hits, newly: newly, newlyPrime: [],
        count: count,
        note: "Cross out the multiples of " + p + " (" + list + "): " + newly.length +
          (newly.length === 1 ? " number is" : " numbers are") + " newly marked composite." });
    }

    var survivors = [];
    for (i = 2; i <= n; i++) {
      if (status[i] === 0) { status[i] = 2; count++; survivors.push(i); }
    }
    frames.push({ n: n, status: status.slice(), p: -1, hits: [], newly: [], newlyPrime: survivors,
      count: count,
      note: "Every p up to √" + n + " ≈ " + limit + " has been tried. The " + survivors.length +
        " numbers never crossed out are all prime." });

    var primes = [];
    for (i = 2; i <= n; i++) if (status[i] === 2) primes.push(i);
    frames.push({ n: n, status: status.slice(), p: -1, hits: [], newly: [], newlyPrime: [], done: true,
      count: count,
      note: "Done: " + count + " primes ≤ " + n + " — " + primes.join(", ") + "." });
    return frames;
  }

  function draw(ctx, f, view) {
    var w = view.w, h = view.h, c = view.colors;
    var n = f.n;
    var total = n - 1; // integers 2..n
    var cols = 10;
    var rows = Math.ceil(total / cols);
    var padX = 20, topPad = 36, botPad = 34;
    var availW = w - padX * 2, availH = h - topPad - botPad;
    var cell = Math.min(56, availW / cols, availH / rows);
    var gw = cell * cols, gh = cell * rows;
    var x0 = (w - gw) / 2;
    var y0 = topPad + (availH - gh) / 2;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // header: current prime on the left, running prime count on the right
    ctx.font = "600 13px ui-monospace, monospace";
    ctx.textAlign = "left";
    if (f.done) {
      ctx.fillStyle = c.good;
      ctx.fillText("sieve complete", x0, 18);
    } else if (f.p >= 0 && f.skip) {
      ctx.fillStyle = c.warn;
      ctx.fillText("p = " + f.p + " (already composite — skip)", x0, 18);
    } else if (f.p >= 0) {
      ctx.fillStyle = c.accent;
      ctx.fillText("current prime p = " + f.p, x0, 18);
    } else {
      ctx.fillStyle = c.muted;
      ctx.fillText("integers 2 – " + n, x0, 18);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = f.count > 0 ? c.good : c.muted;
    ctx.fillText("primes found: " + f.count, x0 + gw, 18);
    ctx.textAlign = "center";

    // grid of numbers 2..n
    var r = Math.min(8, cell * 0.2);
    var numFont = "600 " + Math.round(cell * 0.38) + "px -apple-system, system-ui, sans-serif";
    for (var v = 2; v <= n; v++) {
      var idx = v - 2;
      var x = x0 + (idx % cols) * cell;
      var y = y0 + Math.floor(idx / cols) * cell;
      var st = f.status[v];
      var isHit = f.hits.indexOf(v) >= 0;         // multiple of p touched this frame
      var isNew = f.newly.indexOf(v) >= 0;        // newly crossed out this frame
      var isNewPrime = f.newlyPrime.indexOf(v) >= 0;
      var isP = v === f.p;

      var fill = c.card, stroke = c.line, txt = c.text, lw = 1, dim = false;
      if (st === 1) {
        fill = withAlpha(c.bad, isHit ? (isNew ? 0.25 : 0.12) : 0.07);
        stroke = isHit ? c.bad : c.line;
        txt = c.muted;
        lw = isHit ? 2 : 1;
        dim = !isHit;
      } else if (st === 2) {
        fill = withAlpha(c.good, isNewPrime ? 0.3 : 0.2);
        stroke = c.good;
        txt = c.text;
        lw = isNewPrime ? 2 : 1;
      }
      if (isP && !f.done) {
        fill = withAlpha(f.skip ? c.warn : c.accent, 0.26);
        stroke = f.skip ? c.warn : c.accent;
        txt = c.text;
        lw = 2.5;
        dim = false;
      }

      rr(ctx, x + 2.5, y + 2.5, cell - 5, cell - 5, r);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.stroke();

      ctx.globalAlpha = dim ? 0.45 : 1;
      ctx.fillStyle = txt;
      ctx.font = numFont;
      ctx.fillText(String(v), x + cell / 2, y + cell / 2 + 1);
      ctx.globalAlpha = 1;

      // diagonal strike through crossed-out cells
      if (st === 1) {
        ctx.beginPath();
        ctx.moveTo(x + cell * 0.24, y + cell * 0.76);
        ctx.lineTo(x + cell * 0.76, y + cell * 0.24);
        ctx.strokeStyle = withAlpha(c.bad, isHit ? 0.9 : 0.45);
        ctx.lineWidth = isHit ? 2 : 1.5;
        ctx.stroke();
      }
    }

    // legend
    var items = [
      { col: c.accent, label: "current p" },
      { col: c.bad, label: "crossed out" },
      { col: c.good, label: "prime" },
    ];
    ctx.font = "11px -apple-system, system-ui, sans-serif";
    var sw = 10, gap = 6, spacing = 18, totalW = 0, i;
    for (i = 0; i < items.length; i++) {
      items[i].tw = ctx.measureText(items[i].label).width;
      totalW += sw + gap + items[i].tw;
    }
    totalW += spacing * (items.length - 1);
    var lx = (w - totalW) / 2;
    var ly = h - botPad / 2;
    ctx.textAlign = "left";
    for (i = 0; i < items.length; i++) {
      rr(ctx, lx, ly - sw / 2, sw, sw, 3);
      ctx.fillStyle = withAlpha(items[i].col, 0.35);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = items[i].col;
      ctx.stroke();
      ctx.fillStyle = c.muted;
      ctx.fillText(items[i].label, lx + sw + gap, ly + 1);
      lx += sw + gap + items[i].tw + spacing;
    }
    ctx.textAlign = "center";
  }

  function withAlpha(hex, a) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex.trim());
    if (!m) return hex;
    return "rgba(" + parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) + "," + a + ")";
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function init() {
    var el = document.getElementById("algviz-math-geometry");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Sieve of Eratosthenes",
      aspect: 16 / 7,
      cases: [
        { name: "n = 30 — 10 primes", input: { n: 30 } },
        { name: "n = 50 — 15 primes", input: { n: 50 } },
        { name: "n = 20 — 8 primes", input: { n: 20 } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

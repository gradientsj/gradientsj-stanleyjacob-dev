/* Container With Most Water visualizer (two pointers). Mirrors the shape of
   viz/binary-search.js, the AlgViz reference implementation. */
(function () {
  "use strict";
  function build(input) {
    var hs = input.heights, n = hs.length;
    var frames = [];
    var l = 0, r = n - 1, best = 0, bestL = -1, bestR = -1;
    frames.push({ hs: hs, l: l, r: r, area: null, best: 0, bestL: -1, bestR: -1,
      isNew: false, phase: "start",
      note: "Start wide: l = 0 and r = " + r + ". The container between the pointers holds water only up to its shorter wall." });
    while (l < r) {
      var hl = hs[l], hr = hs[r], width = r - l;
      var area = Math.min(hl, hr) * width;
      var isNew = area > best;
      if (isNew) { best = area; bestL = l; bestR = r; }
      frames.push({ hs: hs, l: l, r: r, hl: hl, hr: hr, area: area, best: best,
        bestL: bestL, bestR: bestR, isNew: isNew, phase: "measure",
        note: "Water level = min(h[" + l + "], h[" + r + "]) = min(" + hl + ", " + hr + ") and width = " + r + " − " + l + " = " + width +
          ", so area = " + Math.min(hl, hr) + " × " + width + " = " + area +
          (isNew ? " — a new maximum!" : ". Best stays " + best + ".") });
      var moved, moveNote;
      if (hl < hr) {
        l++; moved = "l";
        moveNote = "h[" + (l - 1) + "] = " + hl + " is the shorter wall and caps the level, so keeping it can never do better. Move l inward to " + l + ".";
      } else if (hr < hl) {
        r--; moved = "r";
        moveNote = "h[" + (r + 1) + "] = " + hr + " is the shorter wall and caps the level, so keeping it can never do better. Move r inward to " + r + ".";
      } else {
        l++; moved = "l";
        moveNote = "Both walls are height " + hl + ", so moving either pointer is fine. Move l inward to " + l + ".";
      }
      frames.push({ hs: hs, l: l, r: r, area: null, best: best,
        bestL: bestL, bestR: bestR, isNew: false, phase: "move", moved: moved,
        note: moveNote });
    }
    frames.push({ hs: hs, l: l, r: r, area: null, best: best,
      bestL: bestL, bestR: bestR, isNew: false, phase: "done",
      note: "The pointers meet at index " + l + ", so every candidate has been considered. The largest container holds area " + best +
        ", between indices " + bestL + " and " + bestR + "." });
    return frames;
  }

  function draw(ctx, f, view) {
    var hs = f.hs, n = hs.length, w = view.w, h = view.h, c = view.colors;
    var padX = 24, padTop = 64, padBot = 26;
    var baseY = h - padBot;
    var barMax = baseY - padTop;
    var cw = Math.min(72, (w - padX * 2) / n);
    var total = cw * n;
    var x0 = (w - total) / 2;
    var maxH = 1;
    for (var k = 0; k < n; k++) if (hs[k] > maxH) maxH = hs[k];
    var scale = barMax / maxH;
    var done = f.phase === "done";

    function cx(i) { return x0 + i * cw + cw / 2; }
    function topY(v) { return baseY - Math.max(3, v * scale); }

    // water (drawn first, so the bars sit in front of it)
    var wL = -1, wR = -1, wCol = c.accent, wAlpha = 0, wLevel = 0, wLabel = null;
    if (f.phase === "measure") {
      wL = f.l; wR = f.r; wLevel = Math.min(hs[f.l], hs[f.r]);
      wCol = f.isNew ? c.good : c.accent; wAlpha = 0.2; wLabel = String(f.area);
    } else if (f.phase === "move" && f.l < f.r) {
      wL = f.l; wR = f.r; wLevel = Math.min(hs[f.l], hs[f.r]);
      wCol = c.accent; wAlpha = 0.08;
    } else if (done && f.bestL >= 0) {
      wL = f.bestL; wR = f.bestR; wLevel = Math.min(hs[f.bestL], hs[f.bestR]);
      wCol = c.good; wAlpha = 0.2; wLabel = String(f.best);
    }
    if (wL >= 0 && wR > wL) {
      var xA = cx(wL), xB = cx(wR), wTop = baseY - wLevel * scale;
      ctx.fillStyle = withAlpha(wCol, wAlpha);
      ctx.fillRect(xA, wTop, xB - xA, baseY - wTop);
      if (wLabel != null) {
        ctx.strokeStyle = withAlpha(wCol, 0.85);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(xA, wTop);
        ctx.lineTo(xB, wTop);
        ctx.stroke();
        if (xB - xA > 64 && baseY - wTop > 24) {
          ctx.font = "700 14px ui-monospace, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = wCol;
          ctx.fillText(wLabel, (xA + xB) / 2, (wTop + baseY) / 2);
        }
      }
    }

    // baseline
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 - 6, baseY + 0.5);
    ctx.lineTo(x0 + total + 6, baseY + 0.5);
    ctx.stroke();

    // bars with height labels above and index labels below
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var i = 0; i < n; i++) {
      var x = x0 + i * cw;
      var yTop = topY(hs[i]);
      var bh = baseY - yTop;
      var inRange = done ? (i >= f.bestL && i <= f.bestR) : (i >= f.l && i <= f.r);
      var stroke = c.line, lw = 1, fill = c.card;
      if (done) {
        if (i === f.bestL || i === f.bestR) { stroke = c.good; lw = 2; fill = withAlpha(c.good, 0.22); }
      } else {
        if (i === f.l) { stroke = c.good; lw = 2; fill = withAlpha(c.good, 0.16); }
        if (i === f.r) { stroke = c.bad; lw = 2; fill = withAlpha(c.bad, 0.16); }
      }
      ctx.globalAlpha = inRange ? 1 : 0.45;
      rr(ctx, x + 3, yTop, cw - 6, bh, Math.min(5, cw / 4, bh / 2));
      ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke; ctx.stroke();
      ctx.font = "600 " + Math.round(Math.min(12, cw * 0.34)) + "px ui-monospace, monospace";
      ctx.fillStyle = (!done && (i === f.l || i === f.r)) ? c.text : c.muted;
      ctx.fillText(String(hs[i]), x + cw / 2, yTop - 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = c.muted;
      ctx.font = Math.round(Math.min(11, cw * 0.3)) + "px ui-monospace, monospace";
      ctx.fillText(String(i), x + cw / 2, baseY + 13);
    }

    // pointer markers above the bars
    ctx.font = "600 12px ui-monospace, monospace";
    function ptr(i, label, col) {
      if (i < 0 || i >= n) return;
      var px = cx(i), py = topY(hs[i]);
      ctx.fillStyle = col;
      ctx.fillText(label, px, py - 30);
      ctx.beginPath();
      ctx.moveTo(px, py - 15);
      ctx.lineTo(px - 4, py - 22);
      ctx.lineTo(px + 4, py - 22);
      ctx.closePath();
      ctx.fill();
    }
    if (f.l === f.r) {
      ptr(f.l, "l r", c.muted);
    } else {
      ptr(f.l, "l", c.good);
      ptr(f.r, "r", c.bad);
    }

    // readout: current area on the left, best so far on the right
    ctx.font = "600 13px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    if (f.phase === "measure") {
      ctx.fillStyle = c.text;
      ctx.fillText("area = min(" + f.hl + ", " + f.hr + ") × " + (f.r - f.l) + " = " + f.area, padX, 20);
    } else if (done) {
      ctx.fillStyle = c.muted;
      ctx.fillText("finished — pointers met", padX, 20);
    } else {
      ctx.fillStyle = c.muted;
      ctx.fillText("area = —", padX, 20);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = f.isNew || done ? c.good : c.muted;
    ctx.fillText("best = " + (f.best > 0 ? f.best : "—") + (f.isNew ? " ★" : ""), w - padX, 20);
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
    var el = document.getElementById("algviz-two-pointers");
    if (!el || !window.AlgViz) return;
    AlgViz.mount(el, {
      title: "Container with most water",
      aspect: 16 / 7,
      cases: [
        { name: "heights [1,8,6,2,5,4,8,3,7] — max 49", input: { heights: [1, 8, 6, 2, 5, 4, 8, 3, 7] } },
        { name: "heights [1,1] — max 1", input: { heights: [1, 1] } },
        { name: "heights [4,3,2,1,4] — max 16", input: { heights: [4, 3, 2, 1, 4] } },
      ],
      build: build,
      draw: draw,
      caption: function (f) { return f.note; },
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
